/**
 * Fiscal v2 — Motor de emissão real (Sprint 011). SERVER-ONLY.
 *
 * Orquestra o caminho completo:
 *   fiscal_settings + companies + sales/sale_items/customers
 *   → payload NF-e → validação → certificado A1 (vault + bucket privado)
 *   → provider real → persistência (documento, artefatos, timeline).
 *
 * Nunca é importado no módulo scope de arquivos client-reachable:
 * o sufixo `.server.ts` bloqueia o bundle de cliente.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { FiscalProvider } from "../provider/fiscal-provider";
import { resolveFiscalProviderFor } from "../provider/resolve.server";
import type { NfePayload, NfeEnvironment, NfeStatus } from "../types";
import { requireCrt } from "../lib/crt";
import { FISCAL_DOCUMENT_COLUMNS } from "../lib/document-columns";
import {
  evaluateCancelEligibility,
  validateCancelReason,
} from "../lib/cancellation";
import {
  ACTIVE_FISCAL_STATUSES,
  isActiveSaleUniqueViolation,
} from "../lib/issue-guard";
import { recordAudit } from "@/lib/audit.server";
import {
  ARTIFACT_LABELS,
  addPending,
  artifactObjectPath,
  artifactPathColumn,
  clearPending,
  computePendingArtifacts,
  extractArtifactUrls,
  mergeArtifactUrls,
  normalizePendingKinds,
  type ArtifactPersistResult,
  type FiscalArtifactKind,
} from "../lib/artifacts";


// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyFrom = (supabase: SB, table: string) => supabase.from(table as never) as any;

const DOC_COLS = FISCAL_DOCUMENT_COLUMNS;

// ----------------------------------------------------------------- secrets

function parseByteaHex(value: unknown): Buffer | null {
  if (!value) return null;
  if (typeof value === "string") {
    const hex = value.startsWith("\\x") ? value.slice(2) : value;
    if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length === 0) return null;
    return Buffer.from(hex, "hex");
  }
  return null;
}

async function decryptSecret(raw: unknown): Promise<string | null> {
  const buf = parseByteaHex(raw);
  if (!buf || buf.length < 30) return null;
  const keyRaw = process.env.FISCAL_SECRETS_KEY;
  if (!keyRaw) throw new Error("FISCAL_SECRETS_KEY não configurada no servidor.");
  const { createDecipheriv, createHash } = await import("crypto");
  const key = createHash("sha256").update(keyRaw).digest();
  // Layout: 1B version || 12B iv || 16B tag || N ciphertext
  const iv = buf.subarray(1, 13);
  const tag = buf.subarray(13, 29);
  const data = buf.subarray(29);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/**
 * Lê um segredo do vault. `fiscal_secrets` é deny-all no RLS → admin client.
 *
 * Sempre devolve o registro MAIS RECENTE (`limit(1)`): registros duplicados
 * (owner_id nulo + índice NULLS DISTINCT) faziam `maybeSingle()` falhar e o
 * segredo era reportado como inexistente.
 *
 * `environment` isola credenciais por ambiente (Produção × Homologação).
 * Quando informado, NUNCA cai para a credencial de outro ambiente.
 */
export async function readSecret(
  companyId: string,
  kind: "provider_api_key" | "provider_admin_key" | "cert_password" | "csc_token",
  ownerId: string | null,
  environment?: NfeEnvironment | null,
): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabaseAdmin.from("fiscal_secrets" as never) as any)
    .select("ciphertext, updated_at")
    .eq("company_id", companyId)
    .eq("kind", kind);
  q = ownerId ? q.eq("owner_id", ownerId) : q.is("owner_id", null);
  if (environment) q = q.eq("environment", environment);
  const { data, error } = await q.order("updated_at", { ascending: false }).limit(1);
  const row = (data as Array<{ ciphertext: unknown }> | null)?.[0] ?? null;
  const log = (decryptSuccess: boolean, err?: unknown) =>
    console.info("[fiscal] readSecret", {
      company_id: companyId,
      kind,
      owner_id: ownerId,
      environment: environment ?? null,
      secret_exists: Boolean(row),
      secret_loaded: Boolean(row),
      decrypt_success: decryptSuccess,
      ...(err ? { error: err instanceof Error ? err.message : String(err) } : {}),
    });

  if (error || !row) {
    log(false, error);
    return null;
  }
  try {
    const plain = await decryptSecret((row as { ciphertext: unknown }).ciphertext);
    log(Boolean(plain));
    return plain;
  } catch (err) {
    log(false, err);
    throw err;
  }
}

/**
 * Credenciais do provedor para UM ambiente.
 *
 * Modelo oficial da Focus NFe: dois tokens por ambiente.
 *   - `apiKey`      → Token da EMPRESA  → emissão/consulta de NF-e.
 *   - `adminApiKey` → Token PRINCIPAL   → `/v2/empresas` (administrativo).
 *
 * Compatibilidade: instalações que só possuem o token de empresa continuam
 * funcionando — `adminApiKey` vem `null` e o provider cai para o de empresa.
 */
export interface ProviderCredentials {
  apiKey: string | null;
  adminApiKey: string | null;
}

export async function readProviderCredentials(
  companyId: string,
  providerId: string,
  environment: NfeEnvironment,
): Promise<ProviderCredentials> {
  if (providerId === "mock") return { apiKey: null, adminApiKey: null };
  const [apiKey, adminApiKey] = await Promise.all([
    readSecret(companyId, "provider_api_key", null, environment),
    readSecret(companyId, "provider_admin_key", null, environment),
  ]);
  return { apiKey, adminApiKey };
}

/** Configuração do provedor para UM ambiente (tabela `fiscal_provider_environments`). */
export interface ProviderEnvironmentRow {
  apiUrl: string | null;
  provisionedAt: string | null;
  provisionedEnvironment: string | null;
  provisionedCertificateId: string | null;
  provisionedNote: string | null;
  lastHealthCheckAt: string | null;
  lastHealthStatus: "ok" | "warning" | "error" | null;
  lastHealthMessage: string | null;
}

const EMPTY_PROVIDER_ENV: ProviderEnvironmentRow = {
  apiUrl: null,
  provisionedAt: null,
  provisionedEnvironment: null,
  provisionedCertificateId: null,
  provisionedNote: null,
  lastHealthCheckAt: null,
  lastHealthStatus: null,
  lastHealthMessage: null,
};

export async function readProviderEnvironment(
  supabase: SB,
  companyId: string,
  environment: NfeEnvironment,
): Promise<ProviderEnvironmentRow> {
  const { data } = await anyFrom(supabase, "fiscal_provider_environments")
    .select(
      "api_url, provisioned_at, provisioned_environment, provisioned_certificate_id," +
        " provisioned_note, last_health_check_at, last_health_status, last_health_message",
    )
    .eq("company_id", companyId)
    .eq("environment", environment)
    .maybeSingle();
  const row = (data ?? null) as Record<string, string | null> | null;
  if (!row) return { ...EMPTY_PROVIDER_ENV };
  return {
    apiUrl: row.api_url ?? null,
    provisionedAt: row.provisioned_at ?? null,
    provisionedEnvironment: row.provisioned_environment ?? null,
    provisionedCertificateId: row.provisioned_certificate_id ?? null,
    provisionedNote: row.provisioned_note ?? null,
    lastHealthCheckAt: row.last_health_check_at ?? null,
    lastHealthStatus: (row.last_health_status as "ok" | "warning" | "error" | null) ?? null,
    lastHealthMessage: row.last_health_message ?? null,
  };
}

/** Upsert idempotente de um ambiente do provedor. */
export async function upsertProviderEnvironment(
  supabase: SB,
  companyId: string,
  environment: NfeEnvironment,
  patch: Record<string, unknown>,
): Promise<void> {
  const { data } = await anyFrom(supabase, "fiscal_provider_environments")
    .update(patch)
    .eq("company_id", companyId)
    .eq("environment", environment)
    .select("company_id")
    .maybeSingle();
  if (data) return;
  await anyFrom(supabase, "fiscal_provider_environments").insert({
    company_id: companyId,
    environment,
    ...patch,
  });
}


// ---------------------------------------------------------------- payload

export interface BuiltContext {
  payload: NfePayload;
  environment: NfeEnvironment;
  providerId: string;
  apiUrl: string | null;
  certificateId: string | null;
  certificateStoragePath: string | null;
  emitterCnpj: string;
  seriesFromSettings: number;
  nextNumber: number | null;
}

async function buildContext(
  supabase: SB,
  companyId: string,
  saleId: string,
  environmentOverride?: NfeEnvironment,
): Promise<BuiltContext> {
  const { data: sale, error: saleErr } = await supabase
    .from("sales")
    .select("id, grand_total, discount, shipping, customer_id, sale_date")
    .eq("company_id", companyId)
    .eq("id", saleId)
    .maybeSingle();
  if (saleErr) throw saleErr;
  if (!sale) throw new Error("Venda não encontrada.");
  const saleRow = sale as unknown as {
    id: string;
    grand_total: number | null;
    discount: number | null;
    shipping: number | null;
    customer_id: string | null;
    sale_date: string | null;
  };


  const { data: itemsRaw, error: itemsErr } = await supabase
    .from("sale_items")
    .select("id, product_id, description, quantity, unit_price, total")
    .eq("sale_id", saleId);
  if (itemsErr) throw itemsErr;
  const items = (itemsRaw ?? []) as unknown as Array<{
    id: string;
    product_id: string | null;
    description: string | null;
    quantity: number | null;
    unit_price: number | null;
    total: number | null;
  }>;

  // NCM vem exclusivamente do cadastro do produto (nunca de fiscal_settings).
  const productIds = Array.from(
    new Set(items.map((it) => it.product_id).filter((v): v is string => Boolean(v))),
  );
  const productNcm = new Map<
    string,
    { name: string; ncm: string | null; sku: string | null; unit: string | null }
  >();
  if (productIds.length) {
    const { data: prods } = await supabase
      .from("products")
      .select("id, name, ncm, sku, unit")
      .eq("company_id", companyId)
      .in("id", productIds);
    for (const pr of (prods ?? []) as unknown as Array<{
      id: string;
      name: string | null;
      ncm: string | null;
      sku: string | null;
      unit: string | null;
    }>) {
      productNcm.set(pr.id, {
        name: pr.name ?? "",
        ncm: pr.ncm ?? null,
        sku: pr.sku ?? null,
        unit: pr.unit ?? null,
      });
    }
  }

  let customer: {
    id: string;
    name: string;
    document: string;
    email: string | null;
    address?: NfePayload["customer"]["address"];
  } | null = null;
  if (saleRow.customer_id) {
    const { data: cust } = await supabase
      .from("customers")
      .select("id, name, document, email, address, address_number, neighborhood, city, state, zip")
      .eq("company_id", companyId)
      .eq("id", saleRow.customer_id)
      .maybeSingle();
    const c = cust as unknown as Record<string, string | null> | null;
    if (c) {
      customer = {
        id: c.id as string,
        name: c.name ?? "",
        document: c.document ?? "",
        email: c.email ?? null,
        address:
          c.address && c.city && c.state && c.zip
            ? {
                street: c.address,
                number: c.address_number ?? "S/N",
                district: c.neighborhood ?? "Centro",
                city: c.city,
                state: c.state,
                zip: c.zip,
              }
            : undefined,
      };
    }
  }

  const { data: companyRaw } = await supabase
    .from("companies")
    .select(
      "id, name, trade_name, cnpj, ie, address, address_number, neighborhood, city, state, zip_code, phone",
    )
    .eq("id", companyId)
    .maybeSingle();
  const co = (companyRaw ?? {}) as unknown as Record<string, string | null>;

  const { data: settingsRaw } = await anyFrom(supabase, "fiscal_settings")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  const st = (settingsRaw ?? null) as {
    nfe_series: number | null;
    nfe_next_number: number | null;
    default_cfop: string | null;
    default_csosn: string | null;
    default_origem: number | null;
    operation_nature: string | null;
    crt: number | null;
    default_environment: NfeEnvironment | null;
  } | null;

  const { data: cfgRaw } = await anyFrom(supabase, "fiscal_provider_config")
    .select("provider_id, environment, api_url")
    .eq("company_id", companyId)
    .maybeSingle();
  const cfg = (cfgRaw ?? null) as {
    provider_id: string | null;
    environment: NfeEnvironment | null;
    api_url: string | null;
  } | null;

  const { data: certs } = await supabase
    .from("fiscal_certificates")
    .select("id, storage_path, is_active, valid_to")
    .eq("company_id", companyId);
  const activeCert =
    (
      (certs ?? []) as unknown as Array<{
        id: string;
        storage_path: string | null;
        is_active: boolean;
        valid_to: string | null;
      }>
    ).find((c) => c.is_active) ?? null;

  const environment: NfeEnvironment =
    environmentOverride ?? st?.default_environment ?? cfg?.environment ?? "homologation";

  // Reemissão após descarte: cada tentativa precisa de uma referência
  // única no provedor. Sufixamos com o nº da tentativa (a 1ª mantém o
  // formato histórico, sem sufixo).
  const { count: previousAttempts } = await anyFrom(supabase, "fiscal_documents")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("sale_id", saleRow.id);
  const attempt = Number(previousAttempts ?? 0) + 1;
  const reference =
    attempt <= 1
      ? `${companyId.slice(0, 8)}-${saleRow.id}`
      : `${companyId.slice(0, 8)}-${saleRow.id}-r${attempt}`;

  const products = items.reduce((acc, it) => acc + Number(it.total ?? 0), 0);
  const discount = Number(saleRow.discount ?? 0);
  // Frete do documento (vFrete). Somente representação: o valor já está
  // embutido em `grand_total` pelo motor de vendas.
  const freight = Number(saleRow.shipping ?? 0);

  const payload: NfePayload = {
    saleId: saleRow.id,
    environment,
    reference,
    issuedAt: new Date().toISOString(),
    customer: {
      id: customer?.id ?? "",
      name: customer?.name ?? "",
      document: customer?.document ?? "",
      email: customer?.email ?? null,
      address: customer?.address,
    },
    items: items.map((it) => ({
      productId: it.product_id ?? it.id,
      // P0.6.3: SKU é o código comercial oficial; UUID só na ausência dele.
      sku: it.product_id ? (productNcm.get(it.product_id)?.sku ?? null) : null,
      unit: it.product_id ? (productNcm.get(it.product_id)?.unit ?? null) : null,
      description: it.description ?? "",
      ncm: it.product_id ? (productNcm.get(it.product_id)?.ncm ?? null) : null,
      cfop: st?.default_cfop ?? null,
      cst: st?.default_csosn ?? null,
      quantity: Number(it.quantity ?? 0),
      unitPrice: Number(it.unit_price ?? 0),
      total: Number(it.total ?? 0),
    })),
    totals: {
      products,
      discount,
      freight,
      total: Number(saleRow.grand_total ?? 0),
    },
    emitter: {
      cnpj: co.cnpj ?? "",
      legalName: co.name ?? "",
      tradeName: co.trade_name ?? null,
      ie: co.ie ?? "",
      street: co.address ?? "",
      number: co.address_number ?? "S/N",
      district: co.neighborhood ?? "Centro",
      city: co.city ?? "",
      state: co.state ?? "",
      zip: co.zip_code ?? "",
      phone: co.phone ?? null,
    },
    fiscal: {
      operationNature:
        st?.operation_nature ?? "Venda de mercadoria adquirida ou recebida de terceiros",
      cfop: st?.default_cfop ?? "5102",
      csosn: st?.default_csosn ?? null,
      // CRT é obrigatório: nunca assumir Simples Nacional por omissão.
      crt: requireCrt(st?.crt),

      origem: st?.default_origem ?? 0,
      series: st?.nfe_series ?? 1,
      number: st?.nfe_next_number ?? null,
    },
  };

  const envCfg = await readProviderEnvironment(supabase, companyId, environment);

  return {
    payload,
    environment,
    providerId: cfg?.provider_id ?? "mock",
    // URL do ambiente selecionado; legado como fallback de compatibilidade.
    apiUrl: envCfg.apiUrl ?? cfg?.api_url ?? null,
    certificateId: activeCert?.id ?? null,
    certificateStoragePath: activeCert?.storage_path ?? null,
    emitterCnpj: co.cnpj ?? "",
    seriesFromSettings: st?.nfe_series ?? 1,
    nextNumber: st?.nfe_next_number ?? null,
  };
}

// -------------------------------------------------------------- validation

export interface EngineIssue {
  field: string;
  message: string;
}

function validatePayload(ctx: BuiltContext): EngineIssue[] {
  const issues: EngineIssue[] = [];
  const p = ctx.payload;
  if (!p.customer.name) issues.push({ field: "customer.name", message: "Cliente sem nome." });
  if (!p.customer.document)
    issues.push({ field: "customer.document", message: "Cliente sem CPF/CNPJ." });
  if (!p.customer.address)
    issues.push({ field: "customer.address", message: "Endereço do cliente incompleto." });
  if (p.items.length === 0) issues.push({ field: "items", message: "Venda sem itens." });
  p.items.forEach((it, i) => {
    if (!it.description)
      issues.push({ field: `items[${i}].description`, message: "Item sem descrição." });
    if (!(it.quantity > 0))
      issues.push({ field: `items[${i}].quantity`, message: "Quantidade inválida." });
  });
  const missingNcm = p.items.filter((it) => !it.ncm).map((it) => it.description || "Produto");
  if (missingNcm.length)
    issues.push({
      field: "items.ncm",
      message: `Produtos sem NCM:\n${Array.from(new Set(missingNcm))
        .map((n) => `- ${n}`)
        .join("\n")}`,
    });
  if (!(p.totals.total > 0))
    issues.push({ field: "totals.total", message: "Valor total deve ser maior que zero." });
  const e = p.emitter;
  if (!e?.cnpj || !e.ie || !e.street || !e.city || !e.state || !e.zip)
    issues.push({ field: "company", message: "Dados fiscais da empresa incompletos." });
  if (ctx.providerId !== "mock" && !ctx.certificateId)
    issues.push({ field: "certificate", message: "Nenhum certificado A1 ativo." });
  return issues;
}

// --------------------------------------------------------------- artifacts

/**
 * Baixa do provedor + grava no bucket privado.
 *
 * NUNCA retorna silenciosamente: qualquer falha vem como
 * `{ ok:false, stage, message }` para que o chamador registre evento,
 * auditoria, log estruturado e marque o documento como pendente.
 */
export async function persistArtifact(
  provider: FiscalProvider,
  companyId: string,
  url: string | undefined | null,
  objectPath: string,
): Promise<ArtifactPersistResult> {
  if (!provider.downloadArtifact) {
    return {
      ok: false,
      stage: "unsupported",
      message: "Provedor não expõe download de artefatos.",
    };
  }
  if (!url) {
    return { ok: false, stage: "empty", message: "Provedor não retornou URL do artefato." };
  }
  let artifact: Awaited<ReturnType<NonNullable<FiscalProvider["downloadArtifact"]>>>;
  try {
    artifact = await provider.downloadArtifact(url);
  } catch (err) {
    return {
      ok: false,
      stage: "download",
      message: err instanceof Error ? err.message : "Falha ao baixar artefato.",
    };
  }
  if (!artifact || !artifact.bytes || artifact.bytes.length === 0) {
    return { ok: false, stage: "download", message: "Download do artefato retornou vazio." };
  }
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage
      .from("fiscal-artifacts")
      .upload(`${companyId}/${objectPath}`, artifact.bytes, {
        contentType: artifact.contentType,
        upsert: true,
      });
    if (error) {
      return { ok: false, stage: "upload", message: error.message || "Falha no upload." };
    }
  } catch (err) {
    return {
      ok: false,
      stage: "upload",
      message: err instanceof Error ? err.message : "Falha ao gravar artefato.",
    };
  }
  return { ok: true, path: `${companyId}/${objectPath}` };
}

/**
 * Persistência observável: em caso de falha registra evento fiscal,
 * auditoria, log estruturado e devolve o resultado ao chamador, que
 * acumula a pendência no documento.
 */
async function persistArtifactTracked(args: {
  supabase: SB;
  provider: FiscalProvider;
  companyId: string;
  documentId: string;
  userId: string | null;
  kind: FiscalArtifactKind;
  url: string | undefined | null;
  objectPath: string;
  source: string;
}): Promise<ArtifactPersistResult> {
  const { supabase, companyId, documentId, userId, kind, url, objectPath, source } = args;
  const result = await persistArtifact(args.provider, companyId, url, objectPath);
  if (result.ok) {
    console.info("[fiscal] artifact.persisted", {
      company_id: companyId,
      document_id: documentId,
      kind,
      path: result.path,
      source,
    });
    return result;
  }

  console.error("[fiscal] artifact.failed", {
    company_id: companyId,
    document_id: documentId,
    kind,
    stage: result.stage,
    message: result.message,
    object_path: objectPath,
    has_url: Boolean(url),
    source,
  });
  await appendEvent(
    supabase,
    companyId,
    documentId,
    "artifact_failed",
    {
      kind,
      label: ARTIFACT_LABELS[kind],
      stage: result.stage,
      message: result.message,
      objectPath,
      source,
    },
    userId,
  );
  await recordAudit(supabase as never, {
    companyId,
    action: "fiscal.artifact.persist",
    module: "fiscal",
    resourceTable: "fiscal_documents",
    resourceId: documentId,
    after: { kind, stage: result.stage, message: result.message, source },
    result: "error",
    error: result.message,
  }).catch(() => undefined);
  return result;
}

/** Aplica ao documento as pendências acumuladas nesta rodada. */
async function markArtifactsPending(
  supabase: SB,
  companyId: string,
  documentId: string,
  pending: FiscalArtifactKind[],
  lastError: string | null,
): Promise<void> {
  await anyFrom(supabase, "fiscal_documents")
    .update({
      artifacts_pending: pending,
      artifacts_last_error: lastError,
      artifacts_checked_at: new Date().toISOString(),
    })
    .eq("company_id", companyId)
    .eq("id", documentId);
}


/** Envia o A1 armazenado ao provedor (server-only, best-effort). */
async function registerCertificate(
  provider: FiscalProvider,
  ctx: BuiltContext,
  companyId: string,
): Promise<string | null> {
  if (!provider.registerCertificate || !ctx.certificateStoragePath || !ctx.certificateId) {
    return null;
  }
  const password = await readSecret(companyId, "cert_password", ctx.certificateId);
  if (!password) return "Senha do certificado A1 não cadastrada.";

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: file, error } = await supabaseAdmin.storage
    .from("fiscal-certificates")
    .download(ctx.certificateStoragePath);
  if (error || !file) return "Não foi possível ler o certificado A1 armazenado.";

  const pfxBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const result = await provider.registerCertificate({
    pfxBase64,
    password,
    cnpj: ctx.emitterCnpj,
  });
  return result.ok ? null : (result.message ?? "Falha ao registrar certificado no provedor.");
}

// ------------------------------------------------- provisionamento provedor

/**
 * Estado de provisionamento da empresa no provedor.
 *
 * `POST /v2/empresas` (Focus NFe) e equivalentes exigem credencial de CONTA
 * (administrativa) e só precisam rodar quando a empresa ainda não existe no
 * provedor ou quando o certificado A1 foi trocado. Reexecutar esse cadastro
 * a cada emissão quebrava notas válidas com "HTTP Basic: Access denied.".
 */
export interface ProviderProvisioningState {
  provisionedAt: string | null;
  provisionedEnvironment: string | null;
  provisionedCertificateId: string | null;
  provisionedNote: string | null;
}

export async function readProviderProvisioning(
  supabase: SB,
  companyId: string,
  environment?: NfeEnvironment,
): Promise<ProviderProvisioningState> {
  // Novo modelo: provisionamento é por ambiente. O legado
  // (`fiscal_provider_config`) só é consultado como fallback.
  if (environment) {
    const env = await readProviderEnvironment(supabase, companyId, environment);
    if (env.provisionedAt) {
      return {
        provisionedAt: env.provisionedAt,
        provisionedEnvironment: env.provisionedEnvironment ?? environment,
        provisionedCertificateId: env.provisionedCertificateId,
        provisionedNote: env.provisionedNote,
      };
    }
  }
  const { data } = await anyFrom(supabase, "fiscal_provider_config")
    .select(
      "provisioned_at, provisioned_environment, provisioned_certificate_id, provisioned_note",
    )
    .eq("company_id", companyId)
    .maybeSingle();
  const row = (data ?? null) as Record<string, string | null> | null;
  return {
    provisionedAt: row?.provisioned_at ?? null,
    provisionedEnvironment: row?.provisioned_environment ?? null,
    provisionedCertificateId: row?.provisioned_certificate_id ?? null,
    provisionedNote: row?.provisioned_note ?? null,
  };
}

/**
 * Provisionado para este ambiente E este certificado. Troca de A1 ou de
 * ambiente invalida o provisionamento e força novo cadastro.
 */
export function isProvisionedFor(
  state: ProviderProvisioningState,
  environment: NfeEnvironment,
  certificateId: string | null,
): boolean {
  if (!state.provisionedAt) return false;
  if (state.provisionedEnvironment !== environment) return false;
  if (!state.provisionedCertificateId) return true; // provisionamento manual
  return state.provisionedCertificateId === certificateId;
}

export async function markProviderProvisioned(args: {
  supabase: SB;
  companyId: string;
  environment: NfeEnvironment;
  certificateId: string | null;
  userId: string | null;
  note: string | null;
}): Promise<void> {
  const { supabase, companyId, environment, certificateId, userId, note } = args;
  const patch = {
    provisioned_at: new Date().toISOString(),
    provisioned_environment: environment,
    provisioned_certificate_id: certificateId,
    provisioned_by: userId,
    provisioned_note: note,
  };
  await upsertProviderEnvironment(supabase, companyId, environment, patch);
  // Espelho legado: mantém a tela legada consistente para o ambiente ativo.
  await anyFrom(supabase, "fiscal_provider_config")
    .update(patch)
    .eq("company_id", companyId)
    .eq("environment", environment);
}

export async function clearProviderProvisioning(
  supabase: SB,
  companyId: string,
  environment?: NfeEnvironment,
): Promise<void> {
  const patch = {
    provisioned_at: null,
    provisioned_environment: null,
    provisioned_certificate_id: null,
    provisioned_by: null,
    provisioned_note: null,
  };
  if (environment) {
    await upsertProviderEnvironment(supabase, companyId, environment, patch);
  } else {
    await anyFrom(supabase, "fiscal_provider_environments")
      .update(patch)
      .eq("company_id", companyId);
  }
  await anyFrom(supabase, "fiscal_provider_config").update(patch).eq("company_id", companyId);
}


/**
 * Provisionamento explícito (primeira configuração, troca de A1 ou
 * reprovisionamento manual). Único caminho que ainda chama
 * `provider.registerCertificate` → `POST /v2/empresas`.
 */
export async function provisionProviderCertificateEngine(args: {
  supabase: SB;
  companyId: string;
  userId: string | null;
  environment: NfeEnvironment;
  /** Marca como provisionada sem contatar o provedor (empresa já cadastrada no painel). */
  markOnly?: boolean;
}): Promise<{ ok: boolean; message: string }> {
  const { supabase, companyId, userId, environment, markOnly = false } = args;

  const { data: certRaw } = await anyFrom(supabase, "fiscal_certificates")
    .select("id, storage_path")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .maybeSingle();
  const cert = (certRaw ?? null) as { id: string; storage_path: string | null } | null;

  if (markOnly) {
    await markProviderProvisioned({
      supabase,
      companyId,
      environment,
      certificateId: cert?.id ?? null,
      userId,
      note: "Marcada manualmente como já provisionada no painel do provedor.",
    });
    return {
      ok: true,
      message: "Empresa marcada como provisionada. A emissão não reenviará o certificado.",
    };
  }

  const provider = await providerForDocument(supabase, companyId, null, environment);
  if (!provider.requiresCertificate || !provider.registerCertificate) {
    await markProviderProvisioned({
      supabase,
      companyId,
      environment,
      certificateId: cert?.id ?? null,
      userId,
      note: "Provedor não exige cadastro de certificado.",
    });
    return { ok: true, message: "Provedor não exige envio de certificado." };
  }

  const { data: coRaw } = await supabase
    .from("companies")
    .select("cnpj")
    .eq("id", companyId)
    .maybeSingle();
  const cnpj = ((coRaw ?? null) as { cnpj: string | null } | null)?.cnpj ?? "";
  if (!cnpj) return { ok: false, message: "CNPJ da empresa não cadastrado." };
  if (!cert?.id || !cert.storage_path)
    return { ok: false, message: "Nenhum certificado A1 ativo cadastrado." };

  const error = await registerCertificate(
    provider,
    {
      certificateId: cert.id,
      certificateStoragePath: cert.storage_path,
      emitterCnpj: cnpj,
    } as BuiltContext,
    companyId,
  );
  if (error) return { ok: false, message: error };

  await markProviderProvisioned({
    supabase,
    companyId,
    environment,
    certificateId: cert.id,
    userId,
    note: "Certificado A1 enviado ao provedor.",
  });
  return { ok: true, message: "Empresa provisionada no provedor com sucesso." };
}

// ------------------------------------------------------------------ events

async function appendEvent(
  supabase: SB,
  companyId: string,
  documentId: string,
  eventType: string,
  payload: Record<string, unknown> | null,
  actorId: string | null,
): Promise<void> {
  await supabase.from("fiscal_events").insert({
    company_id: companyId,
    document_id: documentId,
    event_type: eventType,
    payload: payload as never,
    actor_id: actorId ?? null,
  } as never);
}

async function patchDocument(
  supabase: SB,
  companyId: string,
  documentId: string,
  patch: Record<string, unknown>,
) {
  const { data, error } = await anyFrom(supabase, "fiscal_documents")
    .update(patch)
    .eq("company_id", companyId)
    .eq("id", documentId)
    .select(DOC_COLS)
    .single();
  if (error) throw error;
  return data as Record<string, unknown>;
}

/**
 * Numeração NF-e — reserva transacional.
 *
 * O número NUNCA é lido do `fiscal_settings` no cliente: a RPC
 * `fiscal_allocate_nfe_number` faz SELECT ... FOR UPDATE na configuração
 * da empresa, calcula o próximo número e grava no documento dentro da
 * mesma transação. Duas emissões concorrentes serializam nesse lock.
 */
async function allocateNumber(
  supabase: SB,
  companyId: string,
  documentId: string,
  series: number,
): Promise<number> {
  const { data, error } = await (supabase as never as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  }).rpc("fiscal_allocate_nfe_number", {
    _company_id: companyId,
    _document_id: documentId,
    _model: "55",
    _series: series,
  });
  if (error) throw error;
  return Number(data);
}

/** Devolve o número quando a nota não chegou a existir na SEFAZ. */
async function releaseNumber(
  supabase: SB,
  companyId: string,
  documentId: string,
): Promise<void> {
  try {
    await (supabase as never as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
    }).rpc("fiscal_release_nfe_number", {
      _company_id: companyId,
      _document_id: documentId,
    });
  } catch {
    // Liberação é best-effort — nunca mascara o erro original da emissão.
  }
}


// ------------------------------------------------------------------- issue

export interface IssueEngineInput {
  supabase: SB;
  companyId: string;
  userId: string | null;
  saleId: string;
  environment?: NfeEnvironment;
}

/**
 * Documento fiscal ativo já existente para a venda (idempotência).
 * Mesma definição de "ativo" do índice único parcial no banco.
 */
async function findActiveSaleDocument(
  supabase: SB,
  companyId: string,
  saleId: string,
): Promise<Record<string, unknown> | null> {
  const { data } = await anyFrom(supabase, "fiscal_documents")
    .select(DOC_COLS)
    .eq("company_id", companyId)
    .eq("sale_id", saleId)
    .in("status", ACTIVE_FISCAL_STATUSES as unknown as string[])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

export async function issueNfeFromSaleEngine(
  input: IssueEngineInput,
): Promise<Record<string, unknown>> {
  const { supabase, companyId, userId, saleId } = input;
  const startedAt = Date.now();

  // 0) Idempotência — venda já possui NF-e ativa: devolve a existente sem
  //    montar payload, sem consultar o provedor e sem consumir numeração.
  const alreadyActive = await findActiveSaleDocument(supabase, companyId, saleId);
  if (alreadyActive) return alreadyActive;

  const ctx = await buildContext(supabase, companyId, saleId, input.environment);
  const credentials = await readProviderCredentials(companyId, ctx.providerId, ctx.environment);
  const provider = resolveFiscalProviderFor({
    providerId: ctx.providerId,
    environment: ctx.environment,
    apiUrl: ctx.apiUrl,
    apiKey: credentials.apiKey,
    adminApiKey: credentials.adminApiKey,
  });

  // 1) Documento em rascunho — histórico auditável mesmo se rejeitado.
  //    O INSERT é o ponto de serialização real: o índice único parcial
  //    `fiscal_documents_one_active_per_sale` deixa apenas UMA transação
  //    concorrente criar o rascunho; as demais recebem 23505 e retornam
  //    o documento vencedor (check-then-act deixa de existir).
  const { data: created, error: createErr } = await anyFrom(supabase, "fiscal_documents")
    .insert({
      company_id: companyId,
      sale_id: saleId,
      customer_id: ctx.payload.customer.id || null,
      status: "draft",
      environment: ctx.environment,
      doc_type: "nfe",
      model: "55",
      series: ctx.seriesFromSettings,
      // Número só é reservado imediatamente antes da transmissão (passo 4).
      number: null,

      operation_nature: ctx.payload.fiscal?.operationNature ?? null,
      cfop: ctx.payload.fiscal?.cfop ?? null,
      total_amount: ctx.payload.totals.total,
      provider: provider.id,
      created_by: userId ?? null,
      request_payload: { reference: ctx.payload.reference } as never,
    })
    .select(DOC_COLS)
    .single();
  if (createErr) {
    if (isActiveSaleUniqueViolation(createErr)) {
      const winner = await findActiveSaleDocument(supabase, companyId, saleId);
      if (winner) return winner;
    }
    throw createErr;
  }
  const documentId = (created as { id: string }).id;

  await appendEvent(
    supabase,
    companyId,
    documentId,
    "created",
    {
      source: "sales",
      saleId,
      provider: provider.id,
      environment: ctx.environment,
    },
    userId,
  );

  // 2) Validação pré-envio.
  await patchDocument(supabase, companyId, documentId, { status: "validating" });
  const issues = validatePayload(ctx);
  if (issues.length > 0) {
    const reason = issues
      .map((i) => `${i.field}: ${i.message}`)
      .join("; ")
      .slice(0, 500);
    const rejected = await patchDocument(supabase, companyId, documentId, {
      status: "rejected",
      rejection_code: "VALIDATION",
      rejection_reason: reason,
    });
    await appendEvent(supabase, companyId, documentId, "rejected", { issues }, userId);
    return rejected;
  }

  // 3) Certificado A1 — o cadastro da empresa no provedor (POST /v2/empresas)
  //    NÃO roda em emissão normal. Só é executado quando a empresa ainda não
  //    está provisionada para este ambiente/certificado (primeira configuração
  //    ou troca do A1). Reprovisionamento manual fica na tela de configuração.
  if (provider.requiresCertificate) {
    const provisioning = await readProviderProvisioning(supabase, companyId, ctx.environment);
    const alreadyProvisioned = isProvisionedFor(provisioning, ctx.environment, ctx.certificateId);

    if (alreadyProvisioned) {
      await appendEvent(
        supabase,
        companyId,
        documentId,
        "certificate_skipped",
        {
          reason: "company_already_provisioned",
          certificateId: ctx.certificateId,
          environment: ctx.environment,
          provisionedAt: provisioning.provisionedAt,
        },
        userId,
      );
    } else {
      await patchDocument(supabase, companyId, documentId, { status: "signing" });
      const certError = await registerCertificate(provider, ctx, companyId);
      if (certError) {
        const rejected = await patchDocument(supabase, companyId, documentId, {
          status: "error",
          rejection_code: "CERTIFICATE",
          rejection_reason: certError.slice(0, 500),
        });
        await appendEvent(supabase, companyId, documentId, "error", { certError }, userId);
        return rejected;
      }
      await markProviderProvisioned({
        supabase,
        companyId,
        environment: ctx.environment,
        certificateId: ctx.certificateId,
        userId,
        note: "Certificado A1 enviado ao provedor durante a primeira emissão.",
      });
      await appendEvent(
        supabase,
        companyId,
        documentId,
        "signed",
        {
          certificateId: ctx.certificateId,
        },
        userId,
      );
    }
  }

  // 4) Reserva transacional do número + transmissão.
  const allocatedNumber = await allocateNumber(
    supabase,
    companyId,
    documentId,
    ctx.seriesFromSettings,
  );
  if (ctx.payload.fiscal) ctx.payload.fiscal.number = allocatedNumber;
  await appendEvent(
    supabase,
    companyId,
    documentId,
    "number_allocated",
    { number: allocatedNumber, series: ctx.seriesFromSettings, model: "55" },
    userId,
  );
  await patchDocument(supabase, companyId, documentId, { status: "sending" });

  // Auditoria: payload lógico completo enviado ao provedor.
  await appendEvent(
    supabase,
    companyId,
    documentId,
    "sent",
    {
      provider: provider.id,
      environment: ctx.environment,
      apiUrl: ctx.apiUrl,
      requestPayload: ctx.payload as unknown as Record<string, unknown>,
      startedAt: new Date(startedAt).toISOString(),
    },
    userId,
  );

  const transmitStart = Date.now();
  let result;
  try {
    result = await provider.issueNfe(ctx.payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const errored = await patchDocument(supabase, companyId, documentId, {
      status: "error",
      rejection_code: "TRANSPORT",
      rejection_reason: message.slice(0, 500),
      response_payload: {
        error: message,
        transmissionMs: Date.now() - transmitStart,
      } as never,
    });
    // A nota não chegou à SEFAZ: devolve o número para a próxima emissão.
    await releaseNumber(supabase, companyId, documentId);
    await appendEvent(
      supabase,
      companyId,
      documentId,
      "error",
      { message, transmissionMs: Date.now() - transmitStart, releasedNumber: allocatedNumber },
      userId,
    );
    return errored;
  }
  const transmissionMs = Date.now() - transmitStart;





  if (!result.ok || result.status === "rejected") {
    const rejected = await patchDocument(supabase, companyId, documentId, {
      status: "rejected",
      rejection_code: result.rejectionCode ?? null,
      rejection_reason: (result.rejectionReason ?? "Rejeitada pelo provedor.").slice(0, 500),
      response_payload: {
        provider: provider.id,
        transmissionMs,
        raw: (result.raw ?? null) as never,
      } as never,
    });
    // Rejeição da SEFAZ/provedor: o número não foi consumido — devolve.
    await releaseNumber(supabase, companyId, documentId);
    await appendEvent(
      supabase,
      companyId,
      documentId,
      "rejected",
      {
        code: result.rejectionCode ?? null,
        reason: result.rejectionReason ?? null,
        transmissionMs,
        releasedNumber: allocatedNumber,
        providerResponse: (result.raw ?? null) as never,
      },
      userId,
    );
    return rejected;
  }


  // 5) Artefatos (XML autorizado + DANFE) no bucket privado da empresa.
  //    Falha aqui NUNCA invalida a autorização: o documento é marcado como
  //    pendente e pode ser reprocessado sem reenviar nada à SEFAZ.
  const key = result.accessKey ?? documentId;
  const artifactPending: FiscalArtifactKind[] = [];
  let artifactError: string | null = null;

  let xmlPath = result.xmlAuthorizedPath ?? null;
  if (!xmlPath) {
    const r = await persistArtifactTracked({
      supabase,
      provider,
      companyId,
      documentId,
      userId,
      kind: "xml_authorized",
      url: result.xmlUrl,
      objectPath: `nfe/${key}.xml`,
      source: "issue",
    });
    if (r.ok) xmlPath = r.path;
    else {
      artifactPending.push("xml_authorized");
      artifactError = r.message;
    }
  }

  let danfePath = result.danfePath ?? null;
  if (!danfePath) {
    const r = await persistArtifactTracked({
      supabase,
      provider,
      companyId,
      documentId,
      userId,
      kind: "danfe",
      url: result.danfeUrl,
      objectPath: `nfe/${key}.pdf`,
      source: "issue",
    });
    if (r.ok) danfePath = r.path;
    else {
      artifactPending.push("danfe");
      artifactError = r.message;
    }
  }


  const authorized = await patchDocument(supabase, companyId, documentId, {
    status: result.status,
    access_key: result.accessKey ?? null,
    number: result.number ?? allocatedNumber,

    series: result.series ?? ctx.seriesFromSettings,
    protocol: result.protocol ?? null,
    protocol_at: result.status === "authorized" ? new Date().toISOString() : null,
    xml_signed_path: result.xmlSignedPath ?? null,
    xml_authorized_path: xmlPath,
    danfe_path: danfePath,
    artifacts_pending: artifactPending,
    artifacts_last_error: artifactError,
    artifacts_checked_at: new Date().toISOString(),

    response_payload: {
      provider: provider.id,
      transmissionMs,
      totalMs: Date.now() - startedAt,
      xmlUrl: result.xmlUrl ?? null,
      danfeUrl: result.danfeUrl ?? null,
      raw: (result.raw ?? null) as never,
    } as never,
    request_payload: {
      reference: ctx.payload.reference,
      providerRef: result.providerRef ?? null,
    } as never,
  });

  await appendEvent(
    supabase,
    companyId,
    documentId,
    result.status === "authorized" ? "authorized" : "sent",
    {
      protocol: result.protocol ?? null,
      accessKey: result.accessKey ?? null,
      providerRef: result.providerRef ?? null,
      number: result.number ?? allocatedNumber,
      series: result.series ?? ctx.seriesFromSettings,
      transmissionMs,
      totalMs: Date.now() - startedAt,
      xmlAuthorizedPath: xmlPath,
      danfePath,
      providerResponse: (result.raw ?? null) as never,
    },
    userId,
  );

  // A sequência já foi avançada atomicamente na reserva do número.
  // Nada a fazer aqui — números autorizados nunca são reaproveitados.



  return authorized;
}

// ------------------------------------------------------------------ status

async function providerForDocument(
  supabase: SB,
  companyId: string,
  documentProvider: string | null,
  environment: NfeEnvironment,
): Promise<FiscalProvider> {
  const { data: cfgRaw } = await anyFrom(supabase, "fiscal_provider_config")
    .select("provider_id, api_url")
    .eq("company_id", companyId)
    .maybeSingle();
  const cfg = (cfgRaw ?? null) as { provider_id: string | null; api_url: string | null } | null;
  const providerId = documentProvider ?? cfg?.provider_id ?? "mock";
  const envCfg = await readProviderEnvironment(supabase, companyId, environment);
  const credentials = await readProviderCredentials(companyId, providerId, environment);
  return resolveFiscalProviderFor({
    providerId,
    environment,
    apiUrl: envCfg.apiUrl ?? cfg?.api_url ?? null,
    apiKey: credentials.apiKey,
    adminApiKey: credentials.adminApiKey,
  });
}

function docRef(doc: Record<string, unknown>): { accessKey?: string; providerRef?: string } {
  const req = (doc.request_payload ?? null) as { reference?: string; providerRef?: string } | null;
  return {
    accessKey: (doc.access_key as string | null) ?? undefined,
    providerRef: req?.providerRef ?? req?.reference ?? undefined,
  };
}

export async function refreshDocumentStatusEngine(args: {
  supabase: SB;
  companyId: string;
  userId: string | null;
  documentId: string;
}): Promise<Record<string, unknown>> {
  const { supabase, companyId, userId, documentId } = args;
  const { data: row, error } = await anyFrom(supabase, "fiscal_documents")
    .select(`${DOC_COLS}, request_payload`)
    .eq("company_id", companyId)
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new Error("Documento fiscal não encontrado.");
  const doc = row as Record<string, unknown>;

  const status = doc.status as NfeStatus;
  // Estados terminais não precisam consultar o provedor.
  if (status === "cancelled" || status === "rejected" || status === "draft") return doc;

  const environment: NfeEnvironment =
    doc.environment === "production" ? "production" : "homologation";
  const provider = await providerForDocument(
    supabase,
    companyId,
    (doc.provider as string | null) ?? null,
    environment,
  );

  const ref = docRef(doc);
  if (!ref.accessKey && !ref.providerRef) return doc;

  const result = await provider.getStatus(ref);
  if (!result.ok) {
    await appendEvent(
      supabase,
      companyId,
      documentId,
      "error",
      {
        message: result.rejectionReason ?? "Falha ao consultar status.",
      },
      userId,
    );
    return doc;
  }

  // Documento em cancelamento: só sai do estado transitório com confirmação
  // oficial (protocolo do evento) ou com status cancelado no provedor.
  if (status === "cancelling") {
    const confirmedProtocol = result.cancellationProtocol ?? null;
    if (result.status === "cancelled" && confirmedProtocol) {
      return await finalizeCancellation({
        supabase,
        provider,
        companyId,
        userId,
        documentId,
        doc,
        reason: (doc.cancellation_reason as string | null) ?? "Cancelamento solicitado.",
        protocol: confirmedProtocol,
        cancelledAt: result.cancelledAt ?? new Date().toISOString(),
        cancellationXmlUrl: result.cancellationXmlUrl ?? null,
        raw: result.raw ?? null,
        deadline: null,
        previousStatus: "cancelling",
        environment,
      });
    }
    if (result.status === "authorized") {
      // SEFAZ não homologou o evento: documento continua válido.
      const reverted = await patchDocument(supabase, companyId, documentId, {
        status: "authorized",
        cancellation_reason: null,
        cancelled_by: null,
      });
      await appendEvent(
        supabase,
        companyId,
        documentId,
        "error",
        { scope: "cancel", message: "Cancelamento não homologado pela SEFAZ." },
        userId,
      );
      console.warn("[fiscal] cancel.not_homologated", {
        company_id: companyId,
        document_id: documentId,
      });
      return reverted;
    }
    console.info("[fiscal] cancel.still_processing", {
      company_id: companyId,
      document_id: documentId,
      providerStatus: result.status,
    });
    return doc; // continua "cancelling"
  }

  if (result.status === status && !result.accessKey) return doc;


  const patch: Record<string, unknown> = { status: result.status };
  if (result.accessKey) patch.access_key = result.accessKey;
  if (result.protocol) patch.protocol = result.protocol;
  if (result.number) patch.number = result.number;
  if (result.series) patch.series = result.series;
  if (result.status === "authorized") {
    patch.protocol_at = (doc.protocol_at as string | null) ?? new Date().toISOString();
    let pending = normalizePendingKinds(doc.artifacts_pending);
    let lastError: string | null = (doc.artifacts_last_error as string | null) ?? null;
    const key = (result.accessKey as string | undefined) ?? (doc.access_key as string | null) ?? documentId;

    if (!doc.xml_authorized_path) {
      const r = await persistArtifactTracked({
        supabase,
        provider,
        companyId,
        documentId,
        userId,
        kind: "xml_authorized",
        url: result.xmlUrl,
        objectPath: `nfe/${key}.xml`,
        source: "status-refresh",
      });
      if (r.ok) {
        patch.xml_authorized_path = r.path;
        pending = clearPending(pending, ["xml_authorized"]);
      } else {
        pending = addPending(pending, "xml_authorized");
        lastError = r.message;
      }
    }
    if (!doc.danfe_path) {
      const r = await persistArtifactTracked({
        supabase,
        provider,
        companyId,
        documentId,
        userId,
        kind: "danfe",
        url: result.danfeUrl,
        objectPath: `nfe/${key}.pdf`,
        source: "status-refresh",
      });
      if (r.ok) {
        patch.danfe_path = r.path;
        pending = clearPending(pending, ["danfe"]);
      } else {
        pending = addPending(pending, "danfe");
        lastError = r.message;
      }
    }
    patch.artifacts_pending = pending;
    patch.artifacts_last_error = pending.length ? lastError : null;
    patch.artifacts_checked_at = new Date().toISOString();
  }

  if (result.status === "rejected") {
    patch.rejection_code = result.rejectionCode ?? null;
    patch.rejection_reason = (result.rejectionReason ?? "Rejeitada pela SEFAZ.").slice(0, 500);
  }
  patch.response_payload = (result.raw ?? null) as never;

  const updated = await patchDocument(supabase, companyId, documentId, patch);
  if (result.status !== status) {
    await appendEvent(
      supabase,
      companyId,
      documentId,
      result.status,
      {
        source: "status-refresh",
        protocol: result.protocol ?? null,
      },
      userId,
    );
  }
  return updated;
}

// ------------------------------------------------------------------ cancel

export async function cancelDocumentEngine(args: {
  supabase: SB;
  companyId: string;
  userId: string | null;
  documentId: string;
  reason: string;
}): Promise<Record<string, unknown>> {
  const { supabase, companyId, userId, documentId, reason } = args;
  const { data: row, error } = await anyFrom(supabase, "fiscal_documents")
    .select(`${DOC_COLS}, request_payload`)
    .eq("company_id", companyId)
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new Error("Documento não encontrado.");
  const doc = row as Record<string, unknown>;
  const status = doc.status as NfeStatus;

  if (status === "cancelled") throw new Error("Documento já cancelado.");
  if (status === "cancelling")
    throw new Error(
      "Cancelamento já solicitado — aguardando confirmação da SEFAZ. Use “Atualizar status”.",
    );

  const reasonError = validateCancelReason(reason);
  if (reasonError) throw new Error(reasonError);

  // Rascunho / rejeitado / erro: cancelamento apenas local (nunca foi à SEFAZ).
  if (status !== "authorized") {
    if (!["draft", "rejected", "error", "validating", "signing"].includes(status)) {
      throw new Error(`Não é permitido cancelar um documento em status ${status}.`);
    }
    const localCancelled = await patchDocument(supabase, companyId, documentId, {
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason.slice(0, 500),
    });
    await appendEvent(
      supabase,
      companyId,
      documentId,
      "cancelled",
      {
        scope: "local",
        reason,
      },
      userId,
    );
    return localCancelled;
  }

  const environment: NfeEnvironment =
    doc.environment === "production" ? "production" : "homologation";
  const provider = await providerForDocument(
    supabase,
    companyId,
    (doc.provider as string | null) ?? null,
    environment,
  );
  const ref = docRef(doc);
  if (!ref.accessKey) throw new Error("NF-e autorizada sem chave de acesso.");

  // Prazo legal (24h da autorização) — a SEFAZ recusa fora da janela.
  const eligibility = evaluateCancelEligibility(
    {
      status,
      accessKey: ref.accessKey,
      protocol: (doc.protocol as string | null) ?? null,
      protocolAt: (doc.protocol_at as string | null) ?? null,
      createdAt: (doc.created_at as string | null) ?? null,
    },
    new Date(),
  );
  if (!eligibility.allowed) {
    await appendEvent(
      supabase,
      companyId,
      documentId,
      "error",
      { scope: "cancel", message: eligibility.reason ?? null, blocked: true },
      userId,
    );
    throw new Error(eligibility.reason ?? "Cancelamento não permitido.");
  }

  // 1) Estado transitório ANTES de falar com o provedor. A partir daqui o
  //    documento nunca volta a aparecer como "Autorizada" na UI, mas também
  //    NÃO é considerado cancelado enquanto a SEFAZ não confirmar.
  const requestedAt = new Date().toISOString();
  await patchDocument(supabase, companyId, documentId, {
    status: "cancelling",
    cancellation_reason: reason.slice(0, 500),
    cancelled_by: userId ?? null,
  });
  await appendEvent(
    supabase,
    companyId,
    documentId,
    "cancel_requested",
    { scope: "sefaz", reason, requestedAt, deadline: eligibility.deadline ?? null },
    userId,
  );
  console.info("[fiscal] cancel.requested", {
    company_id: companyId,
    document_id: documentId,
    environment,
    requestedAt,
  });

  const startedAt = Date.now();
  let result: Awaited<ReturnType<typeof provider.cancelNfe>>;
  try {
    result = await provider.cancelNfe(
      { accessKey: ref.accessKey, providerRef: ref.providerRef },
      reason,
    );
  } catch (err) {
    // Falha de transporte/timeout: o pedido pode ter chegado à SEFAZ.
    // Mantém o estado transitório e deixa a reconsulta decidir.
    const message = err instanceof Error ? err.message : String(err);
    console.error("[fiscal] cancel.transport_error", {
      company_id: companyId,
      document_id: documentId,
      message,
      elapsedMs: Date.now() - startedAt,
    });
    await appendEvent(
      supabase,
      companyId,
      documentId,
      "cancelling",
      { scope: "sefaz", stage: "transport_error", message, reason },
      userId,
    );
    throw new Error(
      "Falha de comunicação com o provedor. O cancelamento continua em processamento — use “Atualizar status”.",
    );
  }

  // 2) Provedor/SEFAZ recusou: volta a AUTORIZADA (nada foi cancelado).
  if (!result.ok) {
    await patchDocument(supabase, companyId, documentId, {
      status: "authorized",
      cancellation_reason: null,
      cancelled_by: null,
      response_payload: (result.raw ?? null) as never,
    });
    await appendEvent(
      supabase,
      companyId,
      documentId,
      "error",
      {
        scope: "cancel",
        message: result.rejectionReason ?? null,
        code: result.rejectionCode ?? null,
        elapsedMs: Date.now() - startedAt,
      },
      userId,
    );
    console.error("[fiscal] cancel.refused", {
      company_id: companyId,
      document_id: documentId,
      code: result.rejectionCode ?? null,
      message: result.rejectionReason ?? null,
      elapsedMs: Date.now() - startedAt,
    });
    throw new Error(result.rejectionReason ?? "Provedor recusou o cancelamento.");
  }

  // 3) Sem confirmação oficial ainda → permanece em "cancelling".
  if (result.status !== "cancelled" || !result.protocol) {
    const pendingDoc = await patchDocument(supabase, companyId, documentId, {
      status: "cancelling",
      response_payload: (result.raw ?? null) as never,
    });
    await appendEvent(
      supabase,
      companyId,
      documentId,
      "cancelling",
      {
        scope: "sefaz",
        stage: "awaiting_sefaz",
        reason,
        elapsedMs: Date.now() - startedAt,
      },
      userId,
    );
    console.warn("[fiscal] cancel.awaiting_sefaz", {
      company_id: companyId,
      document_id: documentId,
      elapsedMs: Date.now() - startedAt,
    });
    return pendingDoc;
  }

  // 4) Confirmado pela SEFAZ (protocolo do evento presente) → persiste tudo.
  return await finalizeCancellation({
    supabase,
    provider,
    companyId,
    userId,
    documentId,
    doc,
    reason,
    protocol: result.protocol,
    cancelledAt: result.cancelledAt ?? new Date().toISOString(),
    cancellationXmlUrl: result.cancellationXmlUrl ?? null,
    raw: result.raw ?? null,
    deadline: eligibility.deadline ?? null,
    previousStatus: status,
    environment,
    elapsedMs: Date.now() - startedAt,
  });
}

/**
 * Persistência ÚNICA do cancelamento confirmado pela SEFAZ.
 *
 * Só é chamada com protocolo do evento em mãos — pelo fluxo síncrono
 * (`cancelDocumentEngine`) ou pela reconsulta (`refreshDocumentStatusEngine`).
 */
async function finalizeCancellation(args: {
  supabase: SB;
  provider: FiscalProvider;
  companyId: string;
  userId: string | null;
  documentId: string;
  doc: Record<string, unknown>;
  reason: string;
  protocol: string;
  cancelledAt: string;
  cancellationXmlUrl: string | null;
  raw: unknown;
  deadline: string | null;
  previousStatus: NfeStatus;
  environment: NfeEnvironment;
  elapsedMs?: number;
}): Promise<Record<string, unknown>> {
  const {
    supabase,
    provider,
    companyId,
    userId,
    documentId,
    doc,
    reason,
    protocol,
    cancelledAt,
    cancellationXmlUrl,
    raw,
    deadline,
    previousStatus,
    environment,
  } = args;

  // XML do evento só é buscado quando o provedor DISPONIBILIZA a URL.
  // Ausência de XML não é falha de artefato (não gera `artifact_failed`).
  let cancellationXmlPath: string | null =
    (doc.xml_cancellation_path as string | null) ?? null;
  let pending = normalizePendingKinds(doc.artifacts_pending);
  let lastError: string | null = (doc.artifacts_last_error as string | null) ?? null;

  if (!cancellationXmlPath && cancellationXmlUrl) {
    const persisted = await persistArtifactTracked({
      supabase,
      provider,
      companyId,
      documentId,
      userId,
      kind: "xml_cancellation",
      url: cancellationXmlUrl,
      objectPath: `${documentId}/cancelamento.xml`,
      source: "cancel",
    });
    if (persisted.ok) {
      cancellationXmlPath = persisted.path;
      pending = clearPending(doc.artifacts_pending, ["xml_cancellation"]);
    } else {
      pending = addPending(doc.artifacts_pending, "xml_cancellation");
      lastError = persisted.message;
    }
  } else if (cancellationXmlPath) {
    pending = clearPending(doc.artifacts_pending, ["xml_cancellation"]);
  }

  const cancelled = await patchDocument(supabase, companyId, documentId, {
    status: "cancelled",
    cancelled_at: cancelledAt,
    cancelled_by: (doc.cancelled_by as string | null) ?? userId ?? null,
    cancellation_reason: reason.slice(0, 500),
    cancellation_protocol: protocol,
    ...(cancellationXmlPath ? { xml_cancellation_path: cancellationXmlPath } : {}),
    artifacts_pending: pending,
    artifacts_last_error: lastError,
    artifacts_checked_at: new Date().toISOString(),
    response_payload: (raw ?? null) as never,
  });

  await appendEvent(
    supabase,
    companyId,
    documentId,
    "cancelled",
    {
      scope: "sefaz",
      protocol,
      cancelledAt,
      deadline,
      xmlPath: cancellationXmlPath,
      reason,
      elapsedMs: args.elapsedMs ?? null,
    },
    userId,
  );
  console.info("[fiscal] cancel.confirmed", {
    company_id: companyId,
    document_id: documentId,
    protocol,
    cancelledAt,
    hasXml: Boolean(cancellationXmlPath),
    elapsedMs: args.elapsedMs ?? null,
  });
  await recordAudit(supabase as never, {
    companyId,
    action: "fiscal.nfe.cancel",
    module: "fiscal",
    resourceTable: "fiscal_documents",
    resourceId: documentId,
    before: {
      status: previousStatus,
      accessKey: (doc.access_key as string | null) ?? null,
      protocol: (doc.protocol as string | null) ?? null,
    },
    after: {
      status: "cancelled",
      cancelledAt,
      cancellationProtocol: protocol,
      reason,
      environment,
    },
    result: "success",
  }).catch(() => undefined);
  return cancelled;
}


// ------------------------------------------------------------ healthcheck

/**
 * Probe de conectividade do provedor usando EXATAMENTE a mesma infraestrutura
 * da emissão: mesma config (`fiscal_provider_config`), mesma credencial do
 * vault e o mesmo objeto provider. Nenhum fetch direto aqui.
 */
export async function probeProviderHealthEngine(args: {
  supabase: SB;
  companyId: string;
  environment: NfeEnvironment;
}): Promise<import("../provider/fiscal-provider").ProviderHealthProbe | null> {
  const { supabase, companyId, environment } = args;
  const provider = await providerForDocument(supabase, companyId, null, environment);
  if (!provider.healthCheck) return null;
  return provider.healthCheck();
}

/**
 * Probe da credencial ADMINISTRATIVA (Token Principal) do ambiente.
 * `null` quando o provedor não expõe endpoints administrativos.
 */
export async function probeProviderAdminHealthEngine(args: {
  supabase: SB;
  companyId: string;
  environment: NfeEnvironment;
}): Promise<
  | {
      probe: import("../provider/fiscal-provider").ProviderHealthProbe;
      hasDedicatedAdminToken: boolean;
    }
  | null
> {
  const { supabase, companyId, environment } = args;
  const provider = await providerForDocument(supabase, companyId, null, environment);
  if (!provider.adminHealthCheck) return null;
  return {
    probe: await provider.adminHealthCheck(),
    hasDedicatedAdminToken: provider.hasDedicatedAdminToken?.() ?? false,
  };
}

// ------------------------------------------------- reprocessamento artefatos

export type ReprocessArtifactsOutcome = {
  document: Record<string, unknown>;
  recovered: FiscalArtifactKind[];
  stillPending: FiscalArtifactKind[];
  /** `true` quando nada precisava ser feito (execução idempotente). */
  noop: boolean;
  message: string;
};

/**
 * Recupera artefatos perdidos (XML autorizado, DANFE, XML de cancelamento).
 *
 * REGRAS:
 *  - NUNCA reenvia a NF-e à SEFAZ. Apenas consulta o provedor (GET) e
 *    baixa os arquivos já existentes.
 *  - Idempotente: artefato já armazenado é ignorado; rodar N vezes converge
 *    para o mesmo estado.
 *  - Toda falha gera evento fiscal + auditoria + log estruturado e mantém a
 *    pendência registrada no documento.
 */
export async function reprocessDocumentArtifactsEngine(args: {
  supabase: SB;
  companyId: string;
  userId: string | null;
  documentId: string;
}): Promise<ReprocessArtifactsOutcome> {
  const { supabase, companyId, userId, documentId } = args;

  const { data: row, error } = await anyFrom(supabase, "fiscal_documents")
    .select(`${DOC_COLS}, request_payload, response_payload`)
    .eq("company_id", companyId)
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new Error("Documento fiscal não encontrado.");
  const doc = row as Record<string, unknown>;

  const docLike = {
    id: documentId,
    status: doc.status as string,
    accessKey: (doc.access_key as string | null) ?? null,
    xmlAuthorizedPath: (doc.xml_authorized_path as string | null) ?? null,
    danfePath: (doc.danfe_path as string | null) ?? null,
    xmlCancellationPath: (doc.xml_cancellation_path as string | null) ?? null,
    artifactsPending: normalizePendingKinds(doc.artifacts_pending),
  };

  const targets = computePendingArtifacts(docLike);
  if (targets.length === 0) {
    // Idempotência: nada pendente → apenas normaliza o marcador e sai.
    if (normalizePendingKinds(doc.artifacts_pending).length > 0) {
      await markArtifactsPending(supabase, companyId, documentId, [], null);
    }
    return {
      document: doc,
      recovered: [],
      stillPending: [],
      noop: true,
      message: "Todos os artefatos já estão armazenados.",
    };
  }

  const environment: NfeEnvironment =
    doc.environment === "production" ? "production" : "homologation";
  const provider = await providerForDocument(
    supabase,
    companyId,
    (doc.provider as string | null) ?? null,
    environment,
  );

  // Fonte 1: payload já armazenado. Fonte 2: consulta (GET) ao provedor.
  let urls = extractArtifactUrls(doc.response_payload);
  const missingUrl = targets.some((kind) => !urls[kind]);
  if (missingUrl) {
    const ref = docRef(doc);
    if (ref.accessKey || ref.providerRef) {
      try {
        const status = await provider.getStatus(ref);
        if (status.ok) {
          urls = mergeArtifactUrls(urls, extractArtifactUrls(status));
        }
      } catch (err) {
        console.error("[fiscal] artifact.reprocess.status_failed", {
          company_id: companyId,
          document_id: documentId,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  const recovered: FiscalArtifactKind[] = [];
  const stillPending: FiscalArtifactKind[] = [];
  let lastError: string | null = null;
  const patch: Record<string, unknown> = {};

  for (const kind of targets) {
    const result = await persistArtifactTracked({
      supabase,
      provider,
      companyId,
      documentId,
      userId,
      kind,
      url: urls[kind],
      objectPath: artifactObjectPath(kind, docLike),
      source: "reprocess",
    });
    if (result.ok) {
      patch[artifactPathColumn(kind)] = result.path;
      recovered.push(kind);
    } else {
      stillPending.push(kind);
      lastError = result.message;
    }
  }

  patch.artifacts_pending = stillPending;
  patch.artifacts_last_error = stillPending.length ? lastError : null;
  patch.artifacts_checked_at = new Date().toISOString();

  const updated = await patchDocument(supabase, companyId, documentId, patch);

  await appendEvent(
    supabase,
    companyId,
    documentId,
    stillPending.length === 0 ? "artifact_recovered" : "artifact_pending",
    {
      attempted: targets,
      recovered,
      stillPending,
      lastError,
      environment,
      provider: provider.id,
    },
    userId,
  );
  await recordAudit(supabase as never, {
    companyId,
    action: "fiscal.artifact.reprocess",
    module: "fiscal",
    resourceTable: "fiscal_documents",
    resourceId: documentId,
    before: { pending: targets },
    after: { recovered, stillPending, environment },
    result: stillPending.length === 0 ? "success" : "error",
    error: stillPending.length === 0 ? null : lastError,
  }).catch(() => undefined);

  return {
    document: updated,
    recovered,
    stillPending,
    noop: false,
    message:
      stillPending.length === 0
        ? `Artefatos recuperados: ${recovered.map((k) => ARTIFACT_LABELS[k]).join(", ")}.`
        : `Ainda pendente: ${stillPending.map((k) => ARTIFACT_LABELS[k]).join(", ")}.`,
  };
}
