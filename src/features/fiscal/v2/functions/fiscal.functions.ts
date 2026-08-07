/**
 * Sprint 007.2 — Server functions do módulo Fiscal.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCompanyId } from "@/lib/company-resolver.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { toCustomerReference } from "@/lib/customer-reference";
import {
  fetchFiscalDocuments,
  fetchFiscalDashboard,
  fetchFiscalDocument,
  fetchFiscalDocumentEvents,
  mapDocument as mapDocFromQuery,
} from "../queries/documents.query";
import {
  fetchFiscalCertificates,
  fetchActiveCertificate,
} from "../queries/certificate.query";
import {
  fetchProviderConfig,
  fetchProviderEnvironments,
} from "../queries/status.query";
import { fetchFiscalSettings } from "../queries/tax.query";
import {
  type FiscalArtifactKind,
  normalizePendingKinds,
} from "../lib/artifacts";
import { FISCAL_DOCUMENT_COLUMNS } from "../lib/document-columns";

import { DocumentsRepository } from "../repositories/documents.repository";
import { CertificateRepository } from "../repositories/certificate.repository";
import { CompanyRepository } from "../repositories/company.repository";
import { ProductsRepository } from "../repositories/products.repository";
import { CustomersRepository } from "../repositories/customers.repository";
import { StatusRepository } from "../repositories/status.repository";
import { TaxRepository } from "../repositories/tax.repository";

type SB = SupabaseClient<Database>;

// -------------------------------------------------------------------- types

export type NfeStatus =
  | "draft"
  | "validating"
  | "signing"
  | "sending"
  | "authorized"
  | "rejected"
  | "cancelling"
  | "cancelled"
  | "error"
  | "discarded";

export type { NfeEnvironment } from "../types/environment";
import { fiscalEnvironmentSchema, type NfeEnvironment } from "../types/environment";
import { resolveItemTaxes } from "../lib/item-taxes";
import {
  buildProviderHealthItems,
  summarizeProviderHealth,
  type ProviderHealthItem,
  type ProviderProbeFacts,
} from "../lib/provider-health";

import {
  CRT_NOT_CONFIGURED_MESSAGE,
  crtCoherenceMessage,
  isCrtCoherent,
  type FiscalTaxRegime,
} from "../lib/crt";

import {
  blocksNewFiscalDocument,
  resolveActiveFiscalDocument,
  resolveFiscalBadgeKey,
  type FiscalDocumentLike,
} from "../lib/fiscal-status";

/** Normaliza linhas de `fiscal_documents` para o formato do helper único. */
function toDocLikes(rows: unknown): FiscalDocumentLike[] {
  return ((rows ?? []) as Array<{
    status: string;
    access_key?: string | null;
    protocol?: string | null;
    created_at?: string | null;
  }>).map((d) => ({
    status: d.status,
    accessKey: d.access_key ?? null,
    protocol: d.protocol ?? null,
    createdAt: d.created_at ?? null,
  }));
}

export type FiscalDocumentDto = {
  id: string;
  companyId: string;
  saleId: string | null;
  number: number | null;
  series: number | null;
  accessKey: string | null;
  status: NfeStatus;
  environment: NfeEnvironment;
  totalAmount: number;
  xmlSignedPath: string | null;
  xmlAuthorizedPath: string | null;
  danfePath: string | null;
  protocol: string | null;
  protocolAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  cancellationProtocol: string | null;
  cancelledBy: string | null;
  xmlCancellationPath: string | null;
  rejectionCode: string | null;
  rejectionReason: string | null;
  provider: string | null;
  discardedAt: string | null;
  discardedBy: string | null;
  discardReason: string | null;
  artifactsPending: FiscalArtifactKind[];
  artifactsLastError: string | null;
  artifactsCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FiscalEventDto = {
  id: string;
  documentId: string;
  eventType: string;
  payloadJson: string | null;
  createdAt: string;
};

// ------------------------------------------------------------------ helpers

async function ensurePermission(
  supabase: SB,
  userId: string,
  companyId: string,
  code:
    | "fiscal.view"
    | "fiscal.create"
    | "fiscal.update"
    | "fiscal.delete"
    | "fiscal.export"
    | "fiscal.manage",
): Promise<void> {
  const repo = new CompanyRepository(supabase);
  const hasPermission = await repo.hasPermission(userId, companyId, code);
  if (!hasPermission) throw new Error(`Acesso negado: ${code}`);
}

type FiscalDocumentRow = {
  id: string;
  company_id: string;
  sale_id: string | null;
  number: number | null;
  series: number | null;
  access_key: string | null;
  status: NfeStatus;
  environment: NfeEnvironment;
  total_amount: number | null;
  xml_signed_path: string | null;
  xml_authorized_path: string | null;
  danfe_path: string | null;
  protocol: string | null;
  protocol_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  cancellation_protocol: string | null;
  cancelled_by: string | null;
  xml_cancellation_path: string | null;
  rejection_code: string | null;
  rejection_reason: string | null;
  provider: string | null;
  discarded_at: string | null;
  discarded_by: string | null;
  discard_reason: string | null;
  artifacts_pending: string[] | null;
  artifacts_last_error: string | null;
  artifacts_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

const mapDocument = (row: FiscalDocumentRow): FiscalDocumentDto => mapDocFromQuery(row as any);



const DOC_COLS = FISCAL_DOCUMENT_COLUMNS;

function docFrom(supabase: SB) {
  // Small helper to avoid re-typing the column list.
  return supabase.from("fiscal_documents" as never);
}

// ------------------------------------------------------------------- LIST

const listSchema = z
  .object({
    status: z.string().optional(),
    saleId: z.string().uuid().optional(),
    search: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.number().int().min(1).max(200).optional(),
  })
  .strict();

export const listFiscalDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof listSchema>) => listSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.view");
    return fetchFiscalDocuments(supabase, companyId, data);
  });


// --------------------------------------------------------------- DASHBOARD

export type FiscalDashboard = {
  totals: Record<NfeStatus, number>;
  monthAuthorized: number;
  monthValue: number;
  lastDocument: FiscalDocumentDto | null;
};

export const getFiscalDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.view");
    return fetchFiscalDashboard(supabase, companyId);
  });


// -------------------------------------------------------------- DOC + HIST

export const getFiscalDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { documentId: string }) =>
    z.object({ documentId: z.string().uuid() }).strict().parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.view");

    const [document, events] = await Promise.all([
      fetchFiscalDocument(supabase, companyId, data.documentId),
      fetchFiscalDocumentEvents(supabase, companyId, data.documentId),
    ]);

    if (!document) throw new Error("Documento fiscal não encontrado.");
    return { document, events };
  });


// ------------------------------------------------------------------ ISSUE
// Cria um documento em rascunho para a venda informada e registra o
// evento inicial. A ligação com um provedor fiscal real acontece na
// Sprint 007.3 (integração SEFAZ).

export const issueFiscalFromSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { saleId: string; environment?: NfeEnvironment; model?: "55" | "65" }) =>
      z
        .object({
          saleId: z.string().uuid(),
          environment: fiscalEnvironmentSchema.optional(),
          // 55 = NF-e (default) · 65 = NFC-e (PDV). Mesmo motor.
          model: z.enum(["55", "65"]).optional(),
        })
        .strict()
        .parse(input),
  )
  .handler(async ({ data, context }): Promise<FiscalDocumentDto> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.create");

    // Valida a venda pertence à empresa.
    const { data: sale, error: saleErr } = await supabase
      .from("sales")
      .select("id")
      .eq("company_id", companyId)
      .eq("id", data.saleId)
      .maybeSingle();
    if (saleErr) throw saleErr;
    if (!sale) throw new Error("Venda não encontrada.");

    // Impede duplicidade usando Repository.
    const repo = new DocumentsRepository(supabase);
    const existingDocs = await repo.findBySaleId(companyId, data.saleId);
    if (blocksNewFiscalDocument(toDocLikes(existingDocs))) {
      throw new Error(
        data.model === "65"
          ? "Já existe uma NFC-e ativa para esta venda."
          : "Já existe uma NF-e ativa para esta venda.",
      );
    }

    // Motor real: validação → certificado A1 → provider → persistência.
    const { issueNfeFromSaleEngine } = await import("./nfe-engine.server");
    const doc = await issueNfeFromSaleEngine({
      supabase: supabase as never,
      companyId,
      userId: context.userId,
      saleId: data.saleId,
      environment: data.environment,
      model: data.model,
    });
    return doc as unknown as FiscalDocumentDto;
  });

// ----------------------------------------------------------------- CANCEL

export const cancelFiscalDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { documentId: string; reason: string }) =>
    z
      .object({
        documentId: z.string().uuid(),
        reason: z.string().min(15).max(255),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<FiscalDocumentDto> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");

    const { cancelDocumentEngine } = await import("./nfe-engine.server");
    const updated = await cancelDocumentEngine({
      supabase: supabase as never,
      companyId,
      userId: context.userId,
      documentId: data.documentId,
      reason: data.reason,
    });
    return updated as unknown as FiscalDocumentDto;
  });

// ------------------------------------------------------------- DISCARD

/**
 * Descarta uma tentativa de emissão que NUNCA foi autorizada.
 *
 * Não apaga nada: o documento permanece no histórico com
 * `status = 'discarded'` + carimbo de quem/quando/por quê, liberando a
 * venda para gerar um NOVO `fiscal_document` na próxima emissão.
 *
 * Bloqueado para documentos autorizados, cancelados ou denegados, e para
 * qualquer documento que já possua chave de acesso ou protocolo.
 */
export const discardFiscalDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { documentId: string; reason?: string }) =>
    z
      .object({
        documentId: z.string().uuid(),
        reason: z.string().trim().min(3).max(255).optional(),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<FiscalDocumentDto> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");

    const repo = new DocumentsRepository(supabase);
    const current = await repo.findById(companyId, data.documentId);
    if (!current) throw new Error("Documento fiscal não encontrado.");

    const row = current;

    if (row.status === "authorized")
      throw new Error("NF-e autorizada não pode ser descartada — utilize o cancelamento.");
    if (row.status === "cancelled")
      throw new Error("NF-e cancelada não pode ser descartada.");
    if (row.status === "rejected" && row.rejectionCode === "denied")
      throw new Error("NF-e denegada não pode ser descartada.");
    if (row.status === "discarded")
      throw new Error("Esta tentativa já foi descartada.");
    if (row.accessKey || row.protocol)
      throw new Error(
        "Documento já possui chave/protocolo na SEFAZ — descarte indisponível.",
      );
    if (!(row.status === "error" || row.status === "rejected"))
      throw new Error(
        `Somente tentativas com erro podem ser descartadas (status atual: ${row.status}).`,
      );

    const reason = data.reason?.trim() || "Reemissão";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await repo.update(companyId, data.documentId, {
      status: "discarded",
      discarded_at: new Date().toISOString(),
      discarded_by: context.userId,
      discard_reason: reason,
    });

    // Evento append-only na linha do tempo do documento.
    await repo.insertEvent({
      company_id: companyId,
      document_id: data.documentId,
      event_type: "discarded",
      actor_id: context.userId,
      payload: { message: `Tentativa descartada — ${reason}.`, reason },
    });

    return updated;

    return updated;
  });

// --------------------------------------------------------- STATUS refresh

export const refreshFiscalStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { documentId: string }) =>
    z.object({ documentId: z.string().uuid() }).strict().parse(input),
  )
  .handler(async ({ data, context }): Promise<FiscalDocumentDto> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.view");

    const { refreshDocumentStatusEngine } = await import("./nfe-engine.server");
    const row = await refreshDocumentStatusEngine({
      supabase: supabase as never,
      companyId,
      userId: context.userId,
      documentId: data.documentId,
    });
    return row as unknown as FiscalDocumentDto;
  });

// ------------------------------------------------- ARTIFACT reprocessamento

export type ReprocessArtifactsResult = {
  document: FiscalDocumentDto;
  recovered: FiscalArtifactKind[];
  stillPending: FiscalArtifactKind[];
  noop: boolean;
  message: string;
};

/**
 * Reprocessa artefatos fiscais pendentes (XML autorizado, DANFE, XML de
 * cancelamento). Nunca reenvia a NF-e à SEFAZ — apenas recupera arquivos
 * do provedor. Execução idempotente.
 */
export const reprocessFiscalArtifacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { documentId: string }) =>
    z.object({ documentId: z.string().uuid() }).strict().parse(input),
  )
  .handler(async ({ data, context }): Promise<ReprocessArtifactsResult> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.update");

    const { reprocessDocumentArtifactsEngine } = await import("./nfe-engine.server");
    const outcome = await reprocessDocumentArtifactsEngine({
      supabase: supabase as never,
      companyId,
      userId: context.userId,
      documentId: data.documentId,
    });
    return {
      document: outcome.document as unknown as FiscalDocumentDto,
      recovered: outcome.recovered,
      stillPending: outcome.stillPending,
      noop: outcome.noop,
      message: outcome.message,
    };
  });

// ----------------------------------------------------- ARTIFACT signed URL

export const getFiscalArtifactUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { path: string }) =>
    z
      .object({ path: z.string().min(3) })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.view");

    if (!data.path.startsWith(`${companyId}/`)) {
      throw new Error("Caminho fora do escopo da empresa.");
    }
    const { data: signed, error } = await supabase.storage
      .from("fiscal-artifacts")
      .createSignedUrl(data.path, 60);
    if (error) throw error;
    return { url: signed.signedUrl };
  });

// ------------------------------------------------------- PROVIDER CONFIG

/** Configuração de UM ambiente (Produção ou Homologação), 100% independente. */
export type FiscalProviderEnvironmentConfig = {
  environment: NfeEnvironment;
  apiUrl: string | null;
  /** Token da EMPRESA (emissão de NF-e) cadastrado neste ambiente. */
  hasApiKey: boolean;
  /** Token PRINCIPAL/Admin (endpoints `/v2/empresas`) cadastrado neste ambiente. */
  hasAdminKey: boolean;
  provisionedAt: string | null;
  provisionedEnvironment: NfeEnvironment | null;
  provisionedCertificateId: string | null;
  provisionedNote: string | null;
  lastHealthCheckAt: string | null;
  lastHealthStatus: "ok" | "warning" | "error" | null;
  lastHealthMessage: string | null;
};

export type FiscalProviderConfig = {
  providerId: string;
  environment: NfeEnvironment;
  apiUrl: string | null;
  notes: string | null;
  webhookUrl: string | null;
  hasApiKey: boolean;
  lastHealthCheckAt: string | null;
  lastHealthStatus: "ok" | "warning" | "error" | null;
  lastHealthMessage: string | null;
  updatedAt: string | null;
  /** Empresa já cadastrada no provedor (POST /v2/empresas não roda na emissão). */
  provisionedAt: string | null;
  provisionedEnvironment: NfeEnvironment | null;
  provisionedCertificateId: string | null;
  provisionedNote: string | null;
  /** Credenciais/URLs independentes por ambiente. */
  environments: Record<NfeEnvironment, FiscalProviderEnvironmentConfig>;
};


const PROVIDER_COLS =
  "provider_id, environment, api_url, notes, webhook_url," +
  " last_health_check_at, last_health_status, last_health_message, updated_at," +
  " provisioned_at, provisioned_environment, provisioned_certificate_id, provisioned_note";

type ProviderRow = {
  provider_id: string;
  environment: NfeEnvironment;
  api_url: string | null;
  notes: string | null;
  webhook_url: string | null;
  last_health_check_at: string | null;
  last_health_status: "ok" | "warning" | "error" | null;
  last_health_message: string | null;
  updated_at: string | null;
  provisioned_at?: string | null;
  provisioned_environment?: NfeEnvironment | null;
  provisioned_certificate_id?: string | null;
  provisioned_note?: string | null;
};

async function fetchHasSecretKind(
  supabase: SB,
  companyId: string,
  kind: "provider_api_key" | "provider_admin_key" | "cert_password" | "csc_token",
  environment?: NfeEnvironment,
): Promise<boolean> {
  const repo = new StatusRepository(supabase);
  return repo.hasSecret(companyId, kind, environment);
}

/** Token de EMPRESA (emissão). Mantido por compatibilidade de nome. */
function fetchHasApiKey(
  supabase: SB,
  companyId: string,
  environment?: NfeEnvironment,
): Promise<boolean> {
  return fetchHasSecretKind(supabase, companyId, "provider_api_key", environment);
}

/** Token PRINCIPAL (administrativo). */
function fetchHasAdminKey(
  supabase: SB,
  companyId: string,
  environment?: NfeEnvironment,
): Promise<boolean> {
  return fetchHasSecretKind(supabase, companyId, "provider_admin_key", environment);
}

type ProviderEnvRow = {
  environment: NfeEnvironment;
  api_url: string | null;
  provisioned_at: string | null;
  provisioned_environment: NfeEnvironment | null;
  provisioned_certificate_id: string | null;
  provisioned_note: string | null;
  last_health_check_at: string | null;
  last_health_status: "ok" | "warning" | "error" | null;
  last_health_message: string | null;
};

const PROVIDER_ENV_COLS =
  "environment, api_url, provisioned_at, provisioned_environment," +
  " provisioned_certificate_id, provisioned_note," +
  " last_health_check_at, last_health_status, last_health_message";

function emptyEnvConfig(environment: NfeEnvironment): FiscalProviderEnvironmentConfig {
  return {
    environment,
    apiUrl: null,
    hasApiKey: false,
    hasAdminKey: false,
    provisionedAt: null,
    provisionedEnvironment: null,
    provisionedCertificateId: null,
    provisionedNote: null,
    lastHealthCheckAt: null,
    lastHealthStatus: null,
    lastHealthMessage: null,
  };
}

/** Lê os DOIS ambientes (linha ausente → ambiente vazio, nunca herda o outro). */
async function fetchEnvironments(
  supabase: SB,
  companyId: string,
): Promise<Record<NfeEnvironment, FiscalProviderEnvironmentConfig>> {
  const repo = new StatusRepository(supabase);
  const rows = await repo.getProviderEnvironments(companyId);
  const out = {
    production: emptyEnvConfig("production"),
    homologation: emptyEnvConfig("homologation"),
  } as Record<NfeEnvironment, FiscalProviderEnvironmentConfig>;
  for (const env of ["production", "homologation"] as const) {
    const row = rows.find((r: any) => r.environment === env) ?? null;
    out[env] = {
      environment: env,
      apiUrl: row?.api_url ?? null,
      hasApiKey: await fetchHasApiKey(supabase, companyId, env),
      hasAdminKey: await fetchHasAdminKey(supabase, companyId, env),
      provisionedAt: row?.provisioned_at ?? null,
      provisionedEnvironment: row?.provisioned_environment ?? null,
      provisionedCertificateId: row?.provisioned_certificate_id ?? null,
      provisionedNote: row?.provisioned_note ?? null,
      lastHealthCheckAt: row?.last_health_check_at ?? null,
      lastHealthStatus: row?.last_health_status ?? null,
      lastHealthMessage: row?.last_health_message ?? null,
    };
  }
  return out;
}

function mapProvider(
  row: ProviderRow | null,
  hasApiKey: boolean,
  environments: Record<NfeEnvironment, FiscalProviderEnvironmentConfig>,
): FiscalProviderConfig {
  if (!row) {
    return {
      providerId: "mock",
      environment: "homologation",
      apiUrl: null,
      notes: null,
      webhookUrl: null,
      hasApiKey: false,
      lastHealthCheckAt: null,
      lastHealthStatus: null,
      lastHealthMessage: null,
      updatedAt: null,
      provisionedAt: null,
      provisionedEnvironment: null,
      provisionedCertificateId: null,
      provisionedNote: null,
      environments,
    };
  }
  const active = environments[row.environment] ?? emptyEnvConfig(row.environment);
  return {
    providerId: row.provider_id,
    environment: row.environment,
    // Campos "ativos" refletem o ambiente selecionado (compatibilidade).
    apiUrl: active.apiUrl ?? row.api_url,
    notes: row.notes,
    webhookUrl: row.webhook_url,
    hasApiKey: active.hasApiKey || hasApiKey,
    lastHealthCheckAt: active.lastHealthCheckAt ?? row.last_health_check_at,
    lastHealthStatus: active.lastHealthStatus ?? row.last_health_status,
    lastHealthMessage: active.lastHealthMessage ?? row.last_health_message,
    updatedAt: row.updated_at,
    provisionedAt: active.provisionedAt ?? row.provisioned_at ?? null,
    provisionedEnvironment:
      active.provisionedEnvironment ?? row.provisioned_environment ?? null,
    provisionedCertificateId:
      active.provisionedCertificateId ?? row.provisioned_certificate_id ?? null,
    provisionedNote: active.provisionedNote ?? row.provisioned_note ?? null,
    environments,
  };
}

export const getFiscalProviderConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FiscalProviderConfig> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.view");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("fiscal_provider_config" as never) as any)
      .select(PROVIDER_COLS)
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw error;
    const hasKey = await fetchHasApiKey(supabase, companyId);
    const environments = await fetchEnvironments(supabase, companyId);
    return mapProvider((data ?? null) as ProviderRow | null, hasKey, environments);
  });


const providerEnvInputSchema = z
  .object({
    apiUrl: z.string().nullish(),
    /** Token da EMPRESA. Vazio/ausente → credencial existente é preservada. */
    apiKey: z.string().max(500).nullish(),
    /** Token PRINCIPAL (admin). Vazio/ausente → credencial existente é preservada. */
    adminApiKey: z.string().max(500).nullish(),
  })
  .strict();

const providerUpdateSchema = z
  .object({
    providerId: z.enum(["mock", "focusnfe", "plugnotas", "tecnospeed", "focus_nfe", "nfe_io"]),
    environment: fiscalEnvironmentSchema,
    apiUrl: z.string().nullish(),
    notes: z.string().max(500).nullish(),
    webhookUrl: z.string().nullish(),
    // Opcional: quando informada, é gravada no vault junto com a configuração
    // (evita o caso em que o usuário digita a chave e salva só o provedor).
    apiKey: z.string().max(500).nullish(),
    /** Configuração independente de cada ambiente (Produção × Homologação). */
    environments: z
      .object({
        production: providerEnvInputSchema.optional(),
        homologation: providerEnvInputSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();


/**
 * Normaliza a URL informada pelo usuário: remove espaços, aceita host sem
 * esquema (`homologacao.focusnfe.com.br` → `https://…`) e devolve `null`
 * apenas quando o campo realmente veio vazio.
 */
function normalizeUrlInput(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim().replace(/\/+$/, "");
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme).toString().replace(/\/+$/, "");
  } catch {
    throw new Error(`URL inválida: ${value}`);
  }
}

export const updateFiscalProviderConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof providerUpdateSchema>) =>
    providerUpdateSchema.parse(input),
  )
  .handler(async ({ data, context }): Promise<FiscalProviderConfig> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");

    const payload = {
      company_id: companyId,
      provider_id: data.providerId,
      environment: data.environment,
      api_url: normalizeUrlInput(data.apiUrl),
      notes: typeof data.notes === "string" && data.notes.trim() ? data.notes.trim() : null,
      webhook_url: normalizeUrlInput(data.webhookUrl),
      updated_by: context.userId,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const table = () => (supabase.from("fiscal_provider_config" as never) as any);

    // UPDATE explícito + INSERT de fallback: o upsert do PostgREST dependia da
    // resolução de conflito e mascarava falhas silenciosas de persistência.
    const { data: updated, error: updateError } = await table()
      .update(payload)
      .eq("company_id", companyId)
      .select(PROVIDER_COLS)
      .maybeSingle();
    if (updateError) throw updateError;

    let row = updated as ProviderRow | null;
    if (!row) {
      const { data: inserted, error: insertError } = await table()
        .insert(payload)
        .select(PROVIDER_COLS)
        .single();
      if (insertError) throw insertError;
      row = inserted as ProviderRow;
    }

    // Read-back: garante que api_url foi realmente gravada (RLS/trigger podem
    // devolver linha sem persistir o valor esperado).
    const { data: verify } = await table()
      .select(PROVIDER_COLS)
      .eq("company_id", companyId)
      .maybeSingle();
    const persisted = (verify ?? row) as ProviderRow;
    if ((persisted?.api_url ?? null) !== payload.api_url) {
      throw new Error(
        "A URL da API não foi persistida (verifique permissões fiscal.manage desta empresa).",
      );
    }

    // ---- Credenciais/URLs por ambiente (independentes) --------------------
    const { upsertProviderEnvironment } = await import("./nfe-engine.server");

    // Compatibilidade: apiUrl/apiKey "soltos" valem para o ambiente ativo.
    const perEnv: Partial<
      Record<
        NfeEnvironment,
        { apiUrl?: string | null; apiKey?: string | null; adminApiKey?: string | null }
      >
    > = {
      [data.environment]: {
        apiUrl: payload.api_url,
        apiKey: typeof data.apiKey === "string" ? data.apiKey : undefined,
      },
      ...(data.environments ?? {}),
    };

    for (const env of ["production", "homologation"] as const) {
      const patchIn = perEnv[env];
      if (!patchIn) continue;
      if (patchIn.apiUrl !== undefined) {
        await upsertProviderEnvironment(supabase, companyId, env, {
          api_url: normalizeUrlInput(patchIn.apiUrl),
          updated_by: context.userId,
        });
      }
      // Token vazio/ausente NUNCA apaga a credencial já gravada do ambiente.
      if (typeof patchIn.apiKey === "string" && patchIn.apiKey.trim().length > 0) {
        await callSetSecret(
          supabase,
          companyId,
          "provider_api_key",
          null,
          patchIn.apiKey.trim(),
          env,
        );
      }
      if (typeof patchIn.adminApiKey === "string" && patchIn.adminApiKey.trim().length > 0) {
        await callSetSecret(
          supabase,
          companyId,
          "provider_admin_key",
          null,
          patchIn.adminApiKey.trim(),
          env,
        );
      }
    }

    const hasKey = await fetchHasApiKey(supabase, companyId);
    const environments = await fetchEnvironments(supabase, companyId);
    console.info("[fiscal] updateProvider", {
      company_id: companyId,
      provider_id: payload.provider_id,
      environment: payload.environment,
      secret_exists: hasKey,
      production_key: environments.production.hasApiKey,
      homologation_key: environments.homologation.hasApiKey,
    });
    return mapProvider(persisted, hasKey, environments);
  });

// -------------------------------------------- PROVISIONAMENTO DA EMPRESA

const provisionSchema = z
  .object({
    /** Marca como provisionada sem chamar o provedor (empresa já cadastrada no painel). */
    markOnly: z.boolean().optional(),
    /** Ambiente alvo; por padrão usa o ambiente configurado. */
    environment: fiscalEnvironmentSchema.optional(),
  })
  .strict();

/**
 * Provisiona a empresa no provedor (envia o A1 via `POST /v2/empresas`) ou
 * marca como já provisionada. É o ÚNICO ponto que dispara esse cadastro —
 * a emissão de NF-e nunca mais o executa quando já provisionada.
 */
export const provisionFiscalProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof provisionSchema>) => provisionSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<{ ok: boolean; message: string }> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cfg } = await (supabase.from("fiscal_provider_config" as never) as any)
      .select("environment")
      .eq("company_id", companyId)
      .maybeSingle();
    const environment: NfeEnvironment =
      data.environment ??
      (((cfg as { environment?: NfeEnvironment } | null)?.environment ??
        "homologation") as NfeEnvironment);

    const { provisionProviderCertificateEngine } = await import("./nfe-engine.server");
    return provisionProviderCertificateEngine({
      supabase,
      companyId,
      userId: context.userId,
      environment,
      markOnly: data.markOnly === true,
    });
  });

/** Remove o provisionamento — próxima emissão volta a cadastrar a empresa. */
export const resetFiscalProviderProvisioning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");
    const { clearProviderProvisioning } = await import("./nfe-engine.server");
    await clearProviderProvisioning(supabase, companyId);
    return { ok: true };
  });


// ------------------------------------------------------- CERTIFICATES

export type FiscalCertificateSummary = {
  id: string;
  alias: string;
  subjectName: string | null;
  subjectCnpj: string | null;
  issuerName: string | null;
  validFrom: string | null;
  validTo: string | null;
  serialNumber: string | null;
  thumbprint: string | null;
  isActive: boolean;
  createdAt: string;
};

function mapCert(row: Record<string, unknown>): FiscalCertificateSummary {
  return {
    id: row.id as string,
    alias: row.alias as string,
    subjectName: (row.subject_name as string | null) ?? null,
    subjectCnpj: (row.subject_cnpj as string | null) ?? null,
    issuerName: (row.issuer_name as string | null) ?? null,
    validFrom: (row.valid_from as string | null) ?? null,
    validTo: (row.valid_to as string | null) ?? null,
    serialNumber: (row.serial_number as string | null) ?? null,
    thumbprint: (row.thumbprint as string | null) ?? null,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at as string,
  };
}

const CERT_COLS =
  "id, alias, subject_name, subject_cnpj, issuer_name, valid_from, valid_to," +
  " serial_number, thumbprint, is_active, created_at";

export const listFiscalCertificates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FiscalCertificateSummary[]> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.view");
    const { data, error } = await supabase
      .from("fiscal_certificates")
      .select(CERT_COLS)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as unknown as Record<string, unknown>[]).map(mapCert);
  });

const certUploadSchema = z
  .object({
    alias: z.string().min(2).max(80),
    subjectName: z.string().min(2).max(200),
    subjectCnpj: z.string().min(11).max(20),
    issuerName: z.string().max(200).nullish(),
    validFrom: z.string(),
    validTo: z.string(),
    serialNumber: z.string().max(80).nullish(),
    thumbprint: z.string().max(120).nullish(),
    fileBase64: z.string().min(20),
    contentType: z.string().default("application/x-pkcs12"),
  })
  .strict();

export const uploadFiscalCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof certUploadSchema>) => certUploadSchema.parse(input))
  .handler(async ({ data, context }): Promise<FiscalCertificateSummary> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");

    // Decodifica base64 → Uint8Array (fileBase64 é apenas o conteúdo binário,
    // sem cabeçalho `data:`)
    const bin = atob(data.fileBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const objectPath = `${companyId}/certs/${crypto.randomUUID()}.pfx`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.storage
      .from("fiscal-certificates")
      .upload(objectPath, bytes, { contentType: data.contentType, upsert: false });
    if (upErr) throw upErr;

    await supabase
      .from("fiscal_certificates")
      .update({ is_active: false })
      .eq("company_id", companyId);

    const { data: row, error } = await supabase
      .from("fiscal_certificates")
      .insert({
        company_id: companyId,
        alias: data.alias,
        subject_name: data.subjectName,
        subject_cnpj: data.subjectCnpj,
        issuer_name: data.issuerName ?? null,
        valid_from: data.validFrom,
        valid_to: data.validTo,
        serial_number: data.serialNumber ?? null,
        thumbprint: data.thumbprint ?? null,
        storage_path: objectPath,
        content_type: data.contentType,
        is_active: true,
        created_by: context.userId,
      })
      .select(CERT_COLS)
      .single();
    if (error) throw error;

    // Troca do A1 invalida o provisionamento: a próxima emissão volta a
    // cadastrar a empresa/certificado no provedor uma única vez.
    const { clearProviderProvisioning } = await import("./nfe-engine.server");
    await clearProviderProvisioning(supabase, companyId);

    return mapCert(row as unknown as Record<string, unknown>);
  });

export const deactivateFiscalCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { certificateId: string }) =>
    z.object({ certificateId: z.string().uuid() }).strict().parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");
    const { error } = await supabase
      .from("fiscal_certificates")
      .update({ is_active: false })
      .eq("company_id", companyId)
      .eq("id", data.certificateId);
    if (error) throw error;
    return { ok: true };
  });

// ========================================================================
// Sprint 007.2.1 — Fiscal settings, secrets vault, provider health, delete
// ========================================================================

// -------- Fiscal settings (regime, série, natureza, CFOP, CSC) -------

export type TaxRegime = "simples" | "presumido" | "real" | "mei";

export type FiscalSettings = {
  companyId: string;
  taxRegime: TaxRegime;
  crt: number | null;
  cnaePrincipal: string | null;
  emitUf: string;
  nfeSeries: number;
  nfeNextNumber: number;
  defaultEnvironment: NfeEnvironment;
  operationNature: string;
  defaultCfop: string;
  defaultCsosn: string | null;
  defaultOrigem: number;
  emailFiscal: string | null;
  phoneFiscal: string | null;
  cscId: string | null;
  hasCscToken: boolean;
  /** Quando true, só vendas pagas ficam elegíveis para emissão de NF-e. */
  issueOnlyAfterPayment: boolean;
  /** Modo de homologação: badges TESTE e filtros automáticos ligados. */
  homologationMode: boolean;
  /** Baixar estoque nas vendas emitidas em homologação (padrão: sim). */
  stockOnHomologation: boolean;
  updatedAt: string | null;
};

type FiscalSettingsRow = {
  company_id: string;
  tax_regime: TaxRegime;
  crt: number | null;
  cnae_principal: string | null;
  emit_uf: string;
  nfe_series: number;
  nfe_next_number: number;
  default_environment: NfeEnvironment;
  operation_nature: string;
  default_cfop: string;
  default_csosn: string | null;
  default_origem: number | null;
  email_fiscal: string | null;
  phone_fiscal: string | null;
  csc_id: string | null;
  issue_only_after_payment: boolean | null;
  homologation_mode: boolean | null;
  stock_on_homologation: boolean | null;
  updated_at: string | null;
};

function defaultSettings(companyId: string): FiscalSettings {
  return {
    companyId,
    taxRegime: "simples",
    crt: 1,
    cnaePrincipal: null,
    emitUf: "SP",
    nfeSeries: 1,
    nfeNextNumber: 1,
    defaultEnvironment: "homologation",
    operationNature: "Venda de mercadoria adquirida ou recebida de terceiros",
    defaultCfop: "5102",
    defaultCsosn: "102",
    defaultOrigem: 0,
    emailFiscal: null,
    phoneFiscal: null,
    cscId: null,
    hasCscToken: false,
    issueOnlyAfterPayment: false,
    homologationMode: true,
    stockOnHomologation: true,
    updatedAt: null,
  };
}

function mapSettings(row: FiscalSettingsRow, hasCscToken: boolean): FiscalSettings {
  return {
    companyId: row.company_id,
    taxRegime: row.tax_regime,
    crt: row.crt,
    cnaePrincipal: row.cnae_principal,
    emitUf: row.emit_uf,
    nfeSeries: row.nfe_series,
    nfeNextNumber: row.nfe_next_number,
    defaultEnvironment: row.default_environment,
    operationNature: row.operation_nature,
    defaultCfop: row.default_cfop,
    defaultCsosn: row.default_csosn,
    defaultOrigem: row.default_origem ?? 0,
    emailFiscal: row.email_fiscal,
    phoneFiscal: row.phone_fiscal,
    cscId: row.csc_id,
    hasCscToken,
    issueOnlyAfterPayment: Boolean(row.issue_only_after_payment),
    homologationMode: row.homologation_mode ?? true,
    stockOnHomologation: row.stock_on_homologation ?? true,
    updatedAt: row.updated_at,
  };
}

export const getFiscalSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.view");
    const settings = await fetchFiscalSettings(supabase, companyId);
    return settings ?? defaultSettings(companyId);
  });


const settingsSchema = z
  .object({
    taxRegime: z.enum(["simples", "presumido", "real", "mei"]),
    crt: z.number().int().min(1).max(4).nullish(),
    cnaePrincipal: z.string().max(20).nullish(),
    emitUf: z
      .string()
      .length(2)
      .transform((s) => s.toUpperCase()),
    nfeSeries: z.number().int().positive(),
    nfeNextNumber: z.number().int().positive(),
    defaultEnvironment: fiscalEnvironmentSchema,
    operationNature: z.string().min(3).max(200),
    defaultCfop: z.string().regex(/^\d{4}$/),
    defaultCsosn: z
      .string()
      .regex(/^\d{2,4}$/)
      .nullish(),
    defaultOrigem: z.number().int().min(0).max(8).default(0),
    emailFiscal: z.string().email().nullish().or(z.literal("")),
    phoneFiscal: z.string().max(30).nullish(),
    cscId: z.string().nullish(),
    issueOnlyAfterPayment: z.boolean().optional(),
    homologationMode: z.boolean().optional(),
    stockOnHomologation: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    // Coerência CRT × regime tributário (MEI → 4, Simples → 1/2, Presumido/Real → 3).
    if (value.crt == null) return;
    if (!isCrtCoherent(value.taxRegime, value.crt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["crt"],
        message: crtCoherenceMessage(value.taxRegime),
      });
    }
  });


export const updateFiscalSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof settingsSchema>) => settingsSchema.parse(input))
  .handler(async ({ data, context }): Promise<FiscalSettings> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabase.from("fiscal_settings" as never) as any)
      .upsert(
        {
          company_id: companyId,
          tax_regime: data.taxRegime,
          crt: data.crt ?? null,
          cnae_principal: data.cnaePrincipal ?? null,
          emit_uf: data.emitUf,
          nfe_series: data.nfeSeries,
          nfe_next_number: data.nfeNextNumber,
          default_environment: data.defaultEnvironment,
          operation_nature: data.operationNature,
          default_cfop: data.defaultCfop,
          default_csosn: data.defaultCsosn ?? null,
          default_origem: data.defaultOrigem,
          email_fiscal: data.emailFiscal || null,
          phone_fiscal: data.phoneFiscal ?? null,
          csc_id: data.cscId ?? null,
          ...(data.issueOnlyAfterPayment === undefined
            ? {}
            : { issue_only_after_payment: data.issueOnlyAfterPayment }),
          ...(data.homologationMode === undefined
            ? {}
            : { homologation_mode: data.homologationMode }),
          ...(data.stockOnHomologation === undefined
            ? {}
            : { stock_on_homologation: data.stockOnHomologation }),
          updated_by: context.userId,
        },
        { onConflict: "company_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    const { data: hasCsc } = await supabase.rpc("fiscal_has_secret", {
      _company_id: companyId,
      _kind: "csc_token",
      _owner_id: null as unknown as string,
    });
    return mapSettings(row as FiscalSettingsRow, Boolean(hasCsc));
  });

// -------- Secrets vault (AES-256-GCM with FISCAL_SECRETS_KEY) --------

async function encryptSecret(plaintext: string): Promise<string> {
  const { createCipheriv, randomBytes, createHash } = await import("crypto");
  const raw = process.env.FISCAL_SECRETS_KEY;
  if (!raw) throw new Error("FISCAL_SECRETS_KEY não configurada no servidor.");
  const key = createHash("sha256").update(raw).digest(); // 32 bytes
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Layout: 1B version || 12B iv || 16B tag || N ciphertext
  const payload = Buffer.concat([Buffer.from([1]), iv, tag, enc]);
  // Postgres bytea literal accepts `\x<hex>` in text form
  return `\\x${payload.toString("hex")}`;
}

async function callSetSecret(
  supabase: SB,
  companyId: string,
  kind: "cert_password" | "provider_api_key" | "provider_admin_key" | "csc_token",
  ownerId: string | null,
  plaintext: string | null,
  environment?: NfeEnvironment | null,
): Promise<void> {
  const ciphertext = plaintext && plaintext.length > 0 ? await encryptSecret(plaintext) : null;
  const { error } = await supabase.rpc("fiscal_set_secret", {
    _company_id: companyId,
    _kind: kind,
    _owner_id: (ownerId ?? null) as unknown as string,
    _ciphertext: ciphertext as unknown as string,
    ...(environment ? { _environment: environment } : {}),
  } as never);
  if (error) throw error;

  // Read-back obrigatório: garante que o segredo gravado é EXATAMENTE o mesmo
  // que o motor de emissão/diagnóstico consegue recuperar e descriptografar.
  // Sem isso, uma gravação silenciosamente perdida era reportada como sucesso.
  if (!ciphertext) return;
  const { readSecret } = await import("./nfe-engine.server");
  let loaded: string | null = null;
  let decryptSuccess = false;
  try {
    loaded = await readSecret(companyId, kind, ownerId, environment ?? null);
    decryptSuccess = loaded !== null;
  } catch {
    decryptSuccess = false;
  }
  console.info("[fiscal] setSecret", {
    company_id: companyId,
    kind,
    owner_id: ownerId,
    environment: environment ?? null,
    secret_exists: true,
    secret_loaded: loaded !== null,
    decrypt_success: decryptSuccess,
    matches_input: loaded === plaintext,
  });
  if (loaded !== plaintext) {
    throw new Error(
      "O segredo foi gravado mas não pôde ser recuperado/descriptografado. Verifique FISCAL_SECRETS_KEY no servidor.",
    );
  }
}


export const setCertificatePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { certificateId: string; password: string }) =>
    z
      .object({
        certificateId: z.string().uuid(),
        password: z.string().min(1).max(200),
      })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");

    const { data: cert, error } = await supabase
      .from("fiscal_certificates")
      .select("id")
      .eq("company_id", companyId)
      .eq("id", data.certificateId)
      .maybeSingle();
    if (error) throw error;
    if (!cert) throw new Error("Certificado não encontrado.");

    await callSetSecret(supabase, companyId, "cert_password", data.certificateId, data.password);
    return { ok: true };
  });

export const setProviderApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      apiKey: string | null;
      environment?: NfeEnvironment;
      credential?: "company" | "admin";
    }) =>
      z
        .object({
          apiKey: z.string().max(500).nullable(),
          /** Ambiente da credencial; omitido = ambiente ativo da empresa. */
          environment: fiscalEnvironmentSchema.optional(),
          /**
           * `company` (default) = Token de EMPRESA usado na emissão.
           * `admin` = Token PRINCIPAL usado em `/v2/empresas`.
           */
          credential: z.enum(["company", "admin"]).optional(),
        })
        .strict()
        .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");
    let environment = data.environment ?? null;
    if (!environment) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cfg } = await (supabase.from("fiscal_provider_config" as never) as any)
        .select("environment")
        .eq("company_id", companyId)
        .maybeSingle();
      environment = ((cfg as { environment?: NfeEnvironment } | null)?.environment ??
        "homologation") as NfeEnvironment;
    }
    const kind =
      data.credential === "admin" ? "provider_admin_key" : ("provider_api_key" as const);
    await callSetSecret(supabase, companyId, kind, null, data.apiKey, environment);
    return { ok: true };
  });


export const setCscToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { token: string | null }) =>
    z
      .object({ token: z.string().max(200).nullable() })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");
    await callSetSecret(supabase, companyId, "csc_token", null, data.token);
    return { ok: true };
  });

// -------- Delete certificate (only when inactive) --------

export const deleteFiscalCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { certificateId: string }) =>
    z.object({ certificateId: z.string().uuid() }).strict().parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");

    // Locate storage path for cleanup
    const { data: cert } = await supabase
      .from("fiscal_certificates")
      .select("id, storage_path, is_active")
      .eq("company_id", companyId)
      .eq("id", data.certificateId)
      .maybeSingle();
    if (!cert) throw new Error("Certificado não encontrado.");
    if ((cert as { is_active: boolean }).is_active) {
      throw new Error("Desative o certificado antes de removê-lo.");
    }
    const storagePath = (cert as { storage_path: string | null }).storage_path;

    const { error } = await supabase.rpc("fiscal_delete_certificate", {
      _certificate_id: data.certificateId,
    });
    if (error) throw error;

    if (storagePath) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage.from("fiscal-certificates").remove([storagePath]);
    }
    return { ok: true };
  });

// -------- Provider health check --------

export type ProviderHealthResult = {
  status: "ok" | "warning" | "error";
  message: string;
  checkedAt: string;
  /** Veredito item a item: qual exatamente falhou. */
  items: ProviderHealthItem[];
};

export type ProviderHealthByEnvironment = {
  production: ProviderHealthResult;
  homologation: ProviderHealthResult;
};

/**
 * Diagnostica UM ambiente usando exclusivamente as credenciais/URL dele.
 * Nunca reaproveita token do outro ambiente e nunca mistura Token Principal
 * com Token Empresa: cada credencial é testada no endpoint que lhe compete.
 */
async function runProviderHealth(
  supabase: SB,
  companyId: string,
  environment: NfeEnvironment,
): Promise<ProviderHealthResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cfg } = await (supabase.from("fiscal_provider_config" as never) as any)
    .select(PROVIDER_COLS)
    .eq("company_id", companyId)
    .maybeSingle();
  const providerId = (cfg as ProviderRow | null)?.provider_id ?? "mock";

  const { readProviderEnvironment, probeProviderHealthEngine, probeProviderAdminHealthEngine } =
    await import("./nfe-engine.server");
  const envCfg = await readProviderEnvironment(supabase, companyId, environment);
  const apiUrl = envCfg.apiUrl ?? null;
  const hasCompanyToken = await fetchHasApiKey(supabase, companyId, environment);
  const hasAdminToken = await fetchHasAdminKey(supabase, companyId, environment);

  const { data: certs } = await supabase
    .from("fiscal_certificates")
    .select("id, is_active")
    .eq("company_id", companyId);
  const activeCert = ((certs ?? []) as Array<{ is_active: boolean }>).find((c) => c.is_active);

  // Probes só fazem sentido quando há URL e a credencial correspondente.
  const canProbe = providerId !== "mock" && Boolean(apiUrl);
  let companyProbe: ProviderProbeFacts | null = null;
  let adminProbe: ProviderProbeFacts | null = null;

  if (canProbe && hasCompanyToken) {
    companyProbe =
      (await probeProviderHealthEngine({ supabase, companyId, environment })) ?? null;
  }
  if (canProbe && hasAdminToken) {
    const admin = await probeProviderAdminHealthEngine({ supabase, companyId, environment });
    adminProbe = admin?.probe ?? null;
  }

  const items = buildProviderHealthItems({
    providerId,
    environment,
    apiUrl,
    hasCompanyToken,
    hasAdminToken,
    hasActiveCertificate: Boolean(activeCert),
    provisionedAt: envCfg.provisionedAt ?? null,
    companyProbe,
    adminProbe,
  });
  const { status, message } = summarizeProviderHealth(items);

  const checkedAt = new Date().toISOString();
  const { upsertProviderEnvironment } = await import("./nfe-engine.server");
  await upsertProviderEnvironment(supabase, companyId, environment, {
    last_health_check_at: checkedAt,
    last_health_status: status,
    last_health_message: message,
  });
  // Espelho legado quando o ambiente testado é o ativo.
  if (((cfg as ProviderRow | null)?.environment ?? null) === environment) {
    await supabase.rpc("fiscal_record_provider_health", {
      _company_id: companyId,
      _status: status,
      _message: message,
    });
  }

  return { status, message, checkedAt, items };
}


export const testProviderConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { environment?: NfeEnvironment }) =>
    z
      .object({ environment: fiscalEnvironmentSchema.optional() })
      .strict()
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<ProviderHealthResult> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");
    let environment = data.environment ?? null;
    if (!environment) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cfg } = await (supabase.from("fiscal_provider_config" as never) as any)
        .select("environment")
        .eq("company_id", companyId)
        .maybeSingle();
      environment = ((cfg as { environment?: NfeEnvironment } | null)?.environment ??
        "homologation") as NfeEnvironment;
    }
    return runProviderHealth(supabase, companyId, environment);
  });

/** Testa Produção e Homologação separadamente (cada uma com seu token). */
export const testProviderConnectionAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProviderHealthByEnvironment> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");
    return {
      production: await runProviderHealth(supabase, companyId, "production"),
      homologation: await runProviderHealth(supabase, companyId, "homologation"),
    };
  });


// -------- Company fiscal profile (read-only) --------

export type CompanyFiscalProfile = {
  id: string;
  legalName: string | null;
  tradeName: string | null;
  cnpj: string | null;
  ie: string | null;
  im: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  addressNumber: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
};

export const getCompanyFiscalProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CompanyFiscalProfile> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.view");

    const { data, error } = await supabase
      .from("companies")
      .select(
        "id, name, trade_name, cnpj, ie, im, phone, email, address, address_number, complement, neighborhood, city, state, zip_code",
      )
      .eq("id", companyId)
      .maybeSingle();
    if (error) throw error;
    const c = (data ?? { id: companyId }) as Record<string, string | null | undefined>;
    return {
      id: companyId,
      legalName: (c.name as string) ?? null,
      tradeName: (c.trade_name as string) ?? null,
      cnpj: (c.cnpj as string) ?? null,
      ie: (c.ie as string) ?? null,
      im: (c.im as string) ?? null,
      phone: (c.phone as string) ?? null,
      email: (c.email as string) ?? null,
      address: (c.address as string) ?? null,
      addressNumber: (c.address_number as string) ?? null,
      complement: (c.complement as string) ?? null,
      neighborhood: (c.neighborhood as string) ?? null,
      city: (c.city as string) ?? null,
      state: (c.state as string) ?? null,
      zipcode: (c.zip_code as string) ?? null,
    };
  });

const companyUpdateSchema = z
  .object({
    legalName: z.string().min(2).max(200),
    tradeName: z.string().max(200).nullish(),
    cnpj: z.string().min(14).max(20),
    ie: z.string().max(30).nullish(),
    im: z.string().max(30).nullish(),
    phone: z.string().max(30).nullish(),
    email: z.string().email().nullish().or(z.literal("")),
    address: z.string().max(200).nullish(),
    addressNumber: z.string().max(20).nullish(),
    complement: z.string().max(100).nullish(),
    neighborhood: z.string().max(100).nullish(),
    city: z.string().max(100).nullish(),
    state: z.string().length(2).nullish(),
    zipcode: z.string().max(15).nullish(),
  })
  .strict();

export const updateCompanyFiscalProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof companyUpdateSchema>) => companyUpdateSchema.parse(input))
  .handler(async ({ data, context }): Promise<CompanyFiscalProfile> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");

    const { error } = await supabase
      .from("companies")
      .update({
        name: data.legalName,
        trade_name: data.tradeName ?? null,
        cnpj: data.cnpj.replace(/\D/g, ""),
        ie: data.ie ?? null,
        im: data.im ?? null,
        phone: data.phone ?? null,
        email: data.email || null,
        address: data.address ?? null,
        address_number: data.addressNumber ?? null,
        complement: data.complement ?? null,
        neighborhood: data.neighborhood ?? null,
        city: data.city ?? null,
        state: data.state ? data.state.toUpperCase() : null,
        zip_code: data.zipcode ?? null,
      })
      .eq("id", companyId);
    if (error) throw error;

    // Read back through the same function to keep shape consistent.
    const { data: row } = await supabase
      .from("companies")
      .select(
        "id, name, trade_name, cnpj, ie, im, phone, email, address, address_number, complement, neighborhood, city, state, zip_code",
      )
      .eq("id", companyId)
      .maybeSingle();
    const c = (row ?? { id: companyId }) as Record<string, string | null | undefined>;
    return {
      id: companyId,
      legalName: (c.name as string) ?? null,
      tradeName: (c.trade_name as string) ?? null,
      cnpj: (c.cnpj as string) ?? null,
      ie: (c.ie as string) ?? null,
      im: (c.im as string) ?? null,
      phone: (c.phone as string) ?? null,
      email: (c.email as string) ?? null,
      address: (c.address as string) ?? null,
      addressNumber: (c.address_number as string) ?? null,
      complement: (c.complement as string) ?? null,
      neighborhood: (c.neighborhood as string) ?? null,
      city: (c.city as string) ?? null,
      state: (c.state as string) ?? null,
      zipcode: (c.zip_code as string) ?? null,
    };
  });

// -------- Sales picker for NF-e issuance --------

/**
 * Status fiscal da venda (independente do status financeiro).
 * - `ready`      → apta para emissão
 * - `incomplete` → faltam dados fiscais obrigatórios
 * - `processing` → NF-e em trânsito (rascunho/validando/assinando/enviando)
 * - `issued`     → possui NF-e AUTORIZADA (único critério de "emitida")
 * - `error`      → última tentativa terminou em erro/rejeição
 * - `cancelled`  → venda cancelada/devolvida
 */
export type FiscalSaleStatus =
  | "ready"
  | "incomplete"
  | "processing"
  | "issued"
  | "error"
  | "rejected"
  | "discarded"
  | "cancelled";

export type FiscalSaleOption = {
  id: string;
  number: string | null;
  saleDate: string | null;
  paidAt: string | null;
  status: string;
  customerName: string | null;
  customerDocument: string | null;
  itemsSummary: string | null;
  itemCount: number;
  totalAmount: number;
  hasActiveNfe: boolean;
  productName: string | null;
  productSku: string | null;
  /** Status fiscal exibido no card do assistente. */
  fiscalStatus: FiscalSaleStatus;
  /** Pendências que impedem a emissão (quando `incomplete`). */
  fiscalIssues: string[];
  /** Pode ser selecionada para emissão (inclui reemissão após erro). */
  canIssue: boolean;
};


export const listSalesForFiscal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { search?: string; limit?: number; includeAll?: boolean }) =>
    z
      .object({
        search: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        includeAll: z.boolean().optional(),
      })
      .strict()
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<FiscalSaleOption[]> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.view");

    const term = data.search?.trim() ?? "";
    const limit = data.limit ?? 20;
    const includeAll = data.includeAll === true;
    // Com busca ativa varremos uma janela maior e filtramos em memória,
    // pois o filtro cobre também tabelas relacionadas (cliente, itens e produtos).
    const fetchLimit = term ? 400 : limit;

    // Regra fiscal da empresa: emitir somente após o pagamento?
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: settingsRow } = await (supabase.from("fiscal_settings" as never) as any)
      .select("issue_only_after_payment")
      .eq("company_id", companyId)
      .maybeSingle();
    const onlyPaid = Boolean(
      (settingsRow as { issue_only_after_payment?: boolean } | null)?.issue_only_after_payment,
    );

    // O critério de listagem é fiscal, não financeiro: todas as vendas
    // efetivadas entram na lista (exceto rascunhos). O status financeiro
    // só filtra quando a empresa exige pagamento prévio.
    // Em modo depuração (includeAll) nenhum filtro é aplicado — inclusive
    // rascunhos e vendas não elegíveis aparecem, com o motivo do bloqueio.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from("sales")
      .select(
        "id, number, sale_date, paid_at, status, grand_total, customers(name, document), sale_items(description, products(name, sku, barcode, ncm))",
      )
      .eq("company_id", companyId);
    if (!includeAll) {
      q = q.neq("status", "draft");
      if (onlyPaid) q = q.eq("status", "paid");
    }

    q = q
      .order("sale_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(fetchLimit);

    const { data: rows, error } = await q;
    if (error) throw error;

    type Row = {
      id: string;
      number: string | null;
      sale_date: string | null;
      paid_at: string | null;
      status: string;
      grand_total: number | null;
      customers: { name: string | null; document: string | null } | null;
      sale_items: Array<{
        description: string | null;
        products: {
          name: string | null;
          sku: string | null;
          barcode: string | null;
          ncm: string | null;
        } | null;
      }> | null;
    };

    let sales = (rows ?? []) as Row[];

    const normalize = (v: string) =>
      v
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR");

    if (term) {
      const needle = normalize(term);
      const digits = term.replace(/\D/g, "");
      sales = sales.filter((s) => {
        const parts: string[] = [s.number ?? "", s.customers?.name ?? ""];
        for (const it of s.sale_items ?? []) {
          parts.push(it.description ?? "");
          parts.push(it.products?.name ?? "");
          parts.push(it.products?.sku ?? "");
          parts.push(it.products?.barcode ?? "");
          if (it.products?.sku) parts.push(toCustomerReference(it.products.sku));
        }
        const haystack = normalize(parts.join(" "));
        if (haystack.includes(needle)) return true;
        if (digits.length >= 3) {
          const doc = (s.customers?.document ?? "").replace(/\D/g, "");
          if (doc && doc.includes(digits)) return true;
          if ((s.number ?? "").replace(/\D/g, "").includes(digits)) return true;
          for (const it of s.sale_items ?? []) {
            const bc = (it.products?.barcode ?? "").replace(/\D/g, "");
            if (bc && bc.includes(digits)) return true;
          }
        }
        return false;
      });
    }
    sales = sales.slice(0, limit);

    const ids = sales.map((s) => s.id);
    // Estado fiscal por venda — derivado EXCLUSIVAMENTE do documento fiscal.
    // "emitida" só quando existe documento AUTORIZADO. Documentos em erro,
    // rejeitados ou apenas criados nunca marcam a venda como emitida.
    // Um único documento ATIVO por venda (descartes ignorados), resolvido
    // pela mesma regra usada no cliente (`resolveActiveFiscalDocument`).
    const activeDocBySale = new Map<string, FiscalDocumentLike>();
    if (ids.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: docs } = await (docFrom(supabase) as any)
        .select("sale_id, status, access_key, protocol, created_at")
        .eq("company_id", companyId)
        .in("sale_id", ids);
      const bySale = new Map<string, FiscalDocumentLike[]>();
      for (const d of (docs ?? []) as Array<{
        sale_id: string | null;
        status: string;
        access_key: string | null;
        protocol: string | null;
        created_at: string | null;
      }>) {
        if (!d.sale_id) continue;
        const list = bySale.get(d.sale_id) ?? [];
        list.push({
          status: d.status,
          accessKey: d.access_key,
          protocol: d.protocol,
          createdAt: d.created_at,
        });
        bySale.set(d.sale_id, list);
      }
      for (const [saleId, list] of bySale) {
        const active = resolveActiveFiscalDocument(list);
        if (active) activeDocBySale.set(saleId, active);
      }
    }

    return sales.map((s) => {
      const items = (s.sale_items ?? [])
        .map((i) => {
          const label = (i.description ?? "").trim() || (i.products?.name ?? "").trim();
          const sku = (i.products?.sku ?? "").trim();
          return sku ? `${label} (${sku})` : label;
        })
        .filter((v) => v.length > 0);
      const summary =
        items.length === 0
          ? null
          : items.length === 1
            ? items[0]
            : `${items[0]} +${items.length - 1}`;
      const firstItem = (s.sale_items ?? [])[0];
      const productName =
        (firstItem?.description ?? "").trim() || (firstItem?.products?.name ?? "").trim() || null;
      const productSku = (firstItem?.products?.sku ?? "").trim() || null;

      // ---- Status fiscal (não financeiro) ----
      const activeDoc = activeDocBySale.get(s.id) ?? null;
      const badgeKey = resolveFiscalBadgeKey(activeDoc);
      // "Emitida" exige documento autorizado COM chave e protocolo.
      const authorized = badgeKey === "issued";
      const processing = badgeKey === "processing";
      // "NF-e ativa" = autorizada ou em trânsito. Documento em erro não conta.
      const hasActiveNfe = authorized || processing;
      const saleCancelled = s.status === "cancelled" || s.status === "refunded";

      const fiscalIssues: string[] = [];
      const lineCount = (s.sale_items ?? []).length;
      if (lineCount === 0) fiscalIssues.push("Venda sem itens.");
      if (!(s.customers?.document ?? "").replace(/\D/g, ""))
        fiscalIssues.push("Cliente sem CPF/CNPJ.");
      const missingNcm = (s.sale_items ?? []).filter(
        (i) => !((i.products?.ncm ?? "").trim()),
      ).length;
      if (missingNcm > 0)
        fiscalIssues.push(
          missingNcm === 1
            ? "1 item sem NCM no cadastro do produto."
            : `${missingNcm} itens sem NCM no cadastro do produto.`,
        );
      if (onlyPaid && s.status !== "paid")
        fiscalIssues.push("Emissão permitida apenas após o pagamento.");
      if (s.status === "draft") fiscalIssues.push("Venda em rascunho (não efetivada).");


      // Badge derivado EXCLUSIVAMENTE do documento fiscal ativo; só quando
      // não há documento é que caímos no estado operacional da venda.
      const fiscalStatus: FiscalSaleStatus = authorized
        ? "issued"
        : processing
          ? "processing"
          : badgeKey === "error"
            ? "error"
            : badgeKey === "rejected"
              ? "rejected"
              : badgeKey === "cancelled"
                ? "cancelled"
                : saleCancelled
                  ? "cancelled"
                  : fiscalIssues.length > 0
                    ? "incomplete"
                    : "ready";

      // Reemissão é permitida quando a última tentativa falhou.
      const canIssue =
        !saleCancelled &&
        !authorized &&
        !processing &&
        fiscalIssues.length === 0;

      return {
        id: s.id,
        number: s.number,
        saleDate: s.sale_date,
        paidAt: s.paid_at,
        status: s.status,
        customerName: s.customers?.name ?? null,
        customerDocument: s.customers?.document ?? null,
        itemsSummary: summary,
        itemCount: items.length,
        totalAmount: Number(s.grand_total ?? 0),
        hasActiveNfe,
        productName,
        productSku,
        fiscalStatus,
        fiscalIssues,
        canIssue,
      };
    });
  });


// ============================================================
// Sprint 009 — Simulação de emissão + contexto do documento
// ============================================================

export type SimulationSeverity = "error" | "warning";

export interface SimulationIssue {
  id: string;
  field: string;
  severity: SimulationSeverity;
  title: string;
  detail: string;
  hint?: string;
  step?: "empresa" | "certificado" | "provedor" | "regras" | "cliente" | "venda";
}

export interface FiscalSimulationResult {
  ok: boolean;
  saleId: string;
  environment: NfeEnvironment;
  provider: string;
  blockers: SimulationIssue[];
  warnings: SimulationIssue[];
  summary: {
    customerName: string | null;
    customerDocument: string | null;
    customerEmail: string | null;
    customerAddress: string | null;
    itemCount: number;
    totalAmount: number;
    cfop: string | null;
    ncm: string | null;
    csosn: string | null;
    crt: number | null;
    natureza: string | null;
    series: number | null;
    numberPreview: number | null;
    hasCertificate: boolean;
    certificateAlias: string | null;
    certificateValidTo: string | null;
    hasProviderKey: boolean;
    certificateExpiresIn: number | null;
    companyName: string | null;
    companyCnpj: string | null;
    saleNumber: number | null;
    items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
      ncm: string | null;
    }>;
  };

}

const simulateSchema = z
  .object({
    saleId: z.string().uuid(),
    environment: fiscalEnvironmentSchema.optional(),
  })
  .strict();

export const simulateFiscalIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof simulateSchema>) => simulateSchema.parse(input))
  .handler(async ({ data, context }): Promise<FiscalSimulationResult> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.view");

    const blockers: SimulationIssue[] = [];
    const warnings: SimulationIssue[] = [];
    const push = (issue: SimulationIssue) =>
      (issue.severity === "error" ? blockers : warnings).push(issue);

    // 1) Venda + cliente
    const { data: saleRow, error: saleErr } = await supabase
      .from("sales")
      .select("id, number, grand_total, customer_id, status")
      .eq("company_id", companyId)
      .eq("id", data.saleId)
      .maybeSingle();
    if (saleErr) throw saleErr;
    if (!saleRow) throw new Error("Venda não encontrada.");
    const sale = saleRow as unknown as {
      id: string;
      number: number | null;
      grand_total: number | null;
      customer_id: string | null;
      status: string;
    };

    type CustomerCtx = {
      name: string | null;
      document: string | null;
      email: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      zip: string | null;
      address_number: string | null;
      neighborhood: string | null;
    };
    let customer: CustomerCtx | null = null;
    if (sale.customer_id) {
      const { data: cust } = await supabase
        .from("customers")
        .select("name, document, email, address, address_number, neighborhood, city, state, zip")
        .eq("company_id", companyId)
        .eq("id", sale.customer_id)
        .maybeSingle();
      customer = (cust ?? null) as unknown as CustomerCtx | null;
    }
    const customerAddress = customer
      ? [
          [customer.address, customer.address_number].filter(Boolean).join(", "),
          customer.neighborhood,
          [customer.city, customer.state].filter(Boolean).join("/"),
          customer.zip,
        ]
          .filter((p) => p && String(p).trim().length > 0)
          .join(" · ") || null
      : null;


    if (!customer) {
      push({
        id: "customer.missing",
        field: "customer",
        severity: "error",
        step: "cliente",
        title: "Cliente não informado na venda",
        detail: "NF-e exige um destinatário identificado.",
        hint: "Vincule um cliente à venda antes de emitir.",
      });
    } else {
      if (!customer.name)
        push({
          id: "customer.name",
          field: "customer.name",
          severity: "error",
          step: "cliente",
          title: "Cliente sem nome",
          detail: "Preencha o nome/razão social do cliente.",
        });
      if (!customer.document)
        push({
          id: "customer.document",
          field: "customer.document",
          severity: "error",
          step: "cliente",
          title: "Cliente sem CPF/CNPJ",
          detail: "Documento é obrigatório para emissão.",
        });
      if (!customer.address || !customer.city || !customer.state || !customer.zip) {
        push({
          id: "customer.address",
          field: "customer.address",
          severity: "error",
          step: "cliente",
          title: "Endereço do cliente incompleto",
          detail: "Logradouro, cidade, UF e CEP são obrigatórios.",
          hint: "Complete o cadastro do cliente.",
        });
      } else if (customer.state.length !== 2) {
        push({
          id: "customer.state",
          field: "customer.address.state",
          severity: "error",
          step: "cliente",
          title: "UF inválida",
          detail: "Use a sigla com 2 letras (ex: SP).",
        });
      }
    }

    // 2) Itens
    const { data: items, error: itemsErr } = await supabase
      .from("sale_items")
      .select("id, product_id, description, quantity, unit_price, total")
      .eq("sale_id", sale.id);
    if (itemsErr) throw itemsErr;
    const itemList = (items ?? []) as Array<{
      id: string;
      product_id: string | null;
      description: string | null;
      quantity: number | null;
      unit_price: number | null;
      total: number | null;
    }>;
    if (itemList.length === 0) {
      push({
        id: "items.empty",
        field: "items",
        severity: "error",
        step: "venda",
        title: "Venda sem itens",
        detail: "NF-e precisa de ao menos um item.",
      });
    } else {
      itemList.forEach((it, i) => {
        if (!it.description)
          push({
            id: `items.${i}.desc`,
            field: `items[${i}].description`,
            severity: "error",
            step: "venda",
            title: `Item ${i + 1} sem descrição`,
            detail: "Descrição do produto é obrigatória.",
          });
        if (!(Number(it.quantity ?? 0) > 0))
          push({
            id: `items.${i}.qty`,
            field: `items[${i}].quantity`,
            severity: "error",
            step: "venda",
            title: `Item ${i + 1} com quantidade inválida`,
            detail: "Quantidade deve ser maior que zero.",
          });
        if (!(Number(it.unit_price ?? 0) >= 0))
          push({
            id: `items.${i}.price`,
            field: `items[${i}].unitPrice`,
            severity: "error",
            step: "venda",
            title: `Item ${i + 1} com preço inválido`,
            detail: "Preço não pode ser negativo.",
          });
      });
    }

    // NCM: obtido exclusivamente do cadastro do produto
    let itemsNcmSummary: string | null = null;
    const byId = new Map<string, { id: string; name: string | null; ncm: string | null }>();
    const productIds = Array.from(
      new Set(itemList.map((it) => it.product_id).filter((v): v is string => Boolean(v))),
    );
    if (productIds.length) {
      const { data: prods } = await supabase
        .from("products")
        .select("id, name, ncm")
        .eq("company_id", companyId)
        .in("id", productIds);
      const list = (prods ?? []) as unknown as Array<{
        id: string;
        name: string | null;
        ncm: string | null;
      }>;
      for (const p of list) byId.set(p.id, p);

      const missing = itemList
        .map((it) => (it.product_id ? byId.get(it.product_id) : null))
        .filter((p): p is { id: string; name: string | null; ncm: string | null } => Boolean(p))
        .filter((p) => !p.ncm)
        .map((p) => p.name ?? "Produto");
      const withoutProduct = itemList.filter((it) => !it.product_id).length;
      const uniqueMissing = Array.from(new Set(missing));
      if (uniqueMissing.length || withoutProduct > 0) {
        push({
          id: "items.ncm",
          field: "items.ncm",
          severity: "error",
          step: "venda",
          title: "Produtos sem NCM",
          detail: uniqueMissing.length
            ? `Produtos sem NCM:\n${uniqueMissing.map((n) => `- ${n}`).join("\n")}`
            : "Há itens sem produto vinculado — não é possível obter o NCM.",
          hint: "Cadastre o NCM no cadastro de cada produto.",
        });
      }
      const codes = Array.from(new Set(list.map((p) => p.ncm).filter(Boolean))) as string[];
      itemsNcmSummary = codes.length === 1 ? codes[0] : codes.length > 1 ? "Vários" : null;
    }

    const total = Number(sale.grand_total ?? 0);
    if (!(total > 0)) {
      push({
        id: "totals.total",
        field: "totals.total",
        severity: "error",
        step: "venda",
        title: "Valor total da venda deve ser maior que zero",
        detail: "Confira valores e descontos antes de emitir.",
      });
    }

    // 3) Empresa
    const { data: companyRow } = await supabase
      .from("companies")
      .select("cnpj, ie, address, city, state, zip_code, name")
      .eq("id", companyId)
      .maybeSingle();
    const co = (companyRow ?? {}) as Record<string, string | null>;
    if (!co.cnpj || !co.ie || !co.address || !co.city || !co.state || !co.zip_code) {
      push({
        id: "company.profile",
        field: "company",
        severity: "error",
        step: "empresa",
        title: "Dados fiscais da empresa incompletos",
        detail: "CNPJ, IE e endereço fiscal são obrigatórios.",
        hint: "Complete em Fiscal → Configuração → Empresa.",
      });
    }

    // 4) Settings (série, CFOP, natureza)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: settingsRow } = await (supabase.from("fiscal_settings" as never) as any)
      .select(
        "nfe_series, nfe_next_number, default_cfop, default_csosn, operation_nature, tax_regime, crt, default_environment",
      )
      .eq("company_id", companyId)
      .maybeSingle();
    const s = (settingsRow ?? null) as {
      nfe_series: number | null;
      nfe_next_number: number | null;
      default_cfop: string | null;
      default_csosn: string | null;
      operation_nature: string | null;
      tax_regime: string | null;
      crt: number | null;
      default_environment: NfeEnvironment | null;
    } | null;
    if (!s) {
      push({
        id: "settings.missing",
        field: "settings",
        severity: "error",
        step: "regras",
        title: "Regras fiscais não configuradas",
        detail: "CFOP, natureza da operação e série não estão definidos.",
        hint: "Abra Fiscal → Configuração → Regras.",
      });
    } else {
      if (!s.default_cfop)
        push({
          id: "settings.cfop",
          field: "settings.cfop",
          severity: "error",
          step: "regras",
          title: "CFOP padrão ausente",
          detail: "Defina um CFOP padrão (ex: 5102).",
        });
      if (!s.operation_nature)
        push({
          id: "settings.nature",
          field: "settings.nature",
          severity: "error",
          step: "regras",
          title: "Natureza da operação ausente",
          detail: "Ex: 'Venda de mercadoria adquirida ou recebida de terceiros'.",
        });
      if (!s.nfe_series || s.nfe_series < 1)
        push({
          id: "settings.series",
          field: "settings.series",
          severity: "error",
          step: "regras",
          title: "Série da NF-e não configurada",
          detail: "Defina a série (normalmente 1).",
        });
      if ((s.tax_regime === "simples" || s.tax_regime === "mei") && !s.default_csosn)
        push({
          id: "settings.csosn",
          field: "settings.csosn",
          severity: "error",
          step: "regras",
          title: "CSOSN padrão obrigatório",
          detail:
            s.tax_regime === "mei"
              ? "MEI exige CSOSN padrão (ex: 102, 103, 300, 400, 500 ou 900)."
              : "Simples Nacional exige CSOSN padrão (ex: 102).",
        });
      if (!s.crt)
        push({
          id: "settings.crt",
          field: "settings.crt",
          severity: "error",
          step: "regras",
          title: "CRT não informado",
          detail: `${CRT_NOT_CONFIGURED_MESSAGE} A emissão fica bloqueada até que o Código de Regime Tributário seja definido.`,
        });
      else if (
        s.tax_regime &&
        !isCrtCoherent(s.tax_regime as FiscalTaxRegime, s.crt)
      )
        push({
          id: "settings.crt.coherence",
          field: "settings.crt",
          severity: "error",
          step: "regras",
          title: "CRT incompatível com o regime tributário",
          detail: crtCoherenceMessage(s.tax_regime as FiscalTaxRegime),
          hint: "Revise em Fiscal → Configuração → Regras.",
        });

    }

    // 4.1) Tributos por item — rejeição 745/750 (item sem grupo PIS/COFINS)
    itemList.forEach((it, i) => {
      const taxes = resolveItemTaxes(
        s?.crt,
        { cst: s?.default_csosn ?? null, amount: Number(it.total ?? 0) },
        s?.default_csosn ?? null,
      );
      if (!taxes.icms.situacaoTributaria)
        push({
          id: `items.${i}.icms`,
          field: `items[${i}].icms`,
          severity: "error",
          step: "regras",
          title: `Item ${i + 1} sem grupo ICMS`,
          detail: "Defina o CST/CSOSN de ICMS nas regras fiscais.",
        });
      if (!taxes.pis.situacaoTributaria)
        push({
          id: `items.${i}.pis`,
          field: `items[${i}].pis`,
          severity: "error",
          step: "regras",
          title: `Item ${i + 1} sem grupo PIS`,
          detail: "O item seria transmitido sem o grupo PIS (rejeição 745).",
          hint: "Revise o CRT/regime tributário em Fiscal → Configuração → Regras.",
        });
      if (!taxes.cofins.situacaoTributaria)
        push({
          id: `items.${i}.cofins`,
          field: `items[${i}].cofins`,
          severity: "error",
          step: "regras",
          title: `Item ${i + 1} sem grupo COFINS`,
          detail: "O item seria transmitido sem o grupo COFINS (rejeição 750).",
          hint: "Revise o CRT/regime tributário em Fiscal → Configuração → Regras.",
        });
    });


    // 5) Certificado
    const { data: certs } = await supabase
      .from("fiscal_certificates")
      .select("id, alias, is_active, valid_to")
      .eq("company_id", companyId);
    const activeCert =
      (
        (certs ?? []) as Array<{
          id: string;
          alias: string;
          is_active: boolean;
          valid_to: string | null;
        }>
      ).find((c) => c.is_active) ?? null;
    let daysLeft: number | null = null;
    if (!activeCert) {
      push({
        id: "cert.missing",
        field: "certificate",
        severity: "error",
        step: "certificado",
        title: "Nenhum certificado A1 ativo",
        detail: "Envie um certificado digital A1 válido.",
      });
    } else if (activeCert.valid_to) {
      daysLeft = Math.round((new Date(activeCert.valid_to).getTime() - Date.now()) / 86_400_000);
      if (daysLeft < 0)
        push({
          id: "cert.expired",
          field: "certificate",
          severity: "error",
          step: "certificado",
          title: "Certificado A1 vencido",
          detail: `Vencido há ${Math.abs(daysLeft)} dia(s).`,
        });
      else if (daysLeft < 30)
        push({
          id: "cert.expiring",
          field: "certificate",
          severity: "warning",
          step: "certificado",
          title: "Certificado vence em breve",
          detail: `Vence em ${daysLeft} dia(s). Renove o quanto antes.`,
        });
    }

    // 6) Senha do certificado
    if (activeCert) {
      const { data: hasCertPwd } = await supabase.rpc("fiscal_has_secret", {
        _company_id: companyId,
        _kind: "cert_password",
        _owner_id: activeCert.id as unknown as string,
      });
      if (!hasCertPwd) {
        push({
          id: "cert.password",
          field: "certificate.password",
          severity: "error",
          step: "certificado",
          title: "Senha do certificado não cadastrada",
          detail: "Informe a senha do PFX para permitir assinatura do XML.",
        });
      }
    }

    // 7) Provedor
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: providerRow } = await (supabase.from("fiscal_provider_config" as never) as any)
      .select("provider_id, api_url, environment, last_health_status")
      .eq("company_id", companyId)
      .maybeSingle();
    const providerId = (providerRow as { provider_id?: string } | null)?.provider_id ?? "mock";
    const apiUrl = (providerRow as { api_url?: string | null } | null)?.api_url ?? null;
    const lastHealth =
      (providerRow as { last_health_status?: string | null } | null)?.last_health_status ?? null;

    const { data: hasApiKey } = await supabase.rpc("fiscal_has_secret", {
      _company_id: companyId,
      _kind: "provider_api_key",
      _owner_id: null as unknown as string,
    });

    if (providerId === "mock") {
      push({
        id: "provider.mock",
        field: "provider",
        severity: "warning",
        step: "provedor",
        title: "Provedor em modo Mock",
        detail: "A emissão será simulada e NÃO será autorizada pela SEFAZ.",
        hint: "Configure Focus/PlugNotas/TecnoSpeed para emitir de verdade.",
      });
    } else {
      if (!apiUrl)
        push({
          id: "provider.url",
          field: "provider.url",
          severity: "error",
          step: "provedor",
          title: "URL do provedor não configurada",
          detail: "Informe a URL da API do provedor.",
        });
      if (!hasApiKey)
        push({
          id: "provider.key",
          field: "provider.key",
          severity: "error",
          step: "provedor",
          title: "API Key do provedor ausente",
          detail: "Cadastre a API Key com segurança.",
        });
      if (lastHealth === "error")
        push({
          id: "provider.health",
          field: "provider.health",
          severity: "warning",
          step: "provedor",
          title: "Último health-check falhou",
          detail: "Teste o provedor no diagnóstico antes de emitir.",
        });
    }

    // 8) Duplicidade — mesma regra da listagem/detalhe (documento ATIVO).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingDocs } = await (docFrom(supabase) as any)
      .select("id, status, access_key, protocol, created_at")
      .eq("company_id", companyId)
      .eq("sale_id", sale.id);
    if (blocksNewFiscalDocument(toDocLikes(existingDocs))) {
      push({
        id: "duplicate",
        field: "sale",
        severity: "error",
        step: "venda",
        title: "Já existe NF-e ativa para esta venda",
        detail: "Cancele ou consulte a nota existente antes de reemitir.",
      });
    }

    const environment: NfeEnvironment =
      data.environment ?? s?.default_environment ?? "homologation";

    return {
      ok: blockers.length === 0,
      saleId: sale.id,
      environment,
      provider: providerId,
      blockers,
      warnings,
      summary: {
        customerName: customer?.name ?? null,
        customerDocument: customer?.document ?? null,
        customerEmail: customer?.email ?? null,
        customerAddress,
        itemCount: itemList.length,
        totalAmount: total,
        cfop: s?.default_cfop ?? null,
        ncm: itemsNcmSummary,
        csosn: s?.default_csosn ?? null,
        crt: s?.crt ?? null,
        natureza: s?.operation_nature ?? null,
        series: s?.nfe_series ?? null,
        numberPreview: s?.nfe_next_number ?? null,
        hasCertificate: Boolean(activeCert),
        certificateAlias: activeCert?.alias ?? null,
        certificateValidTo: activeCert?.valid_to ?? null,
        hasProviderKey: Boolean(hasApiKey),
        certificateExpiresIn: daysLeft,
        companyName: (co.name as string | null) ?? null,
        companyCnpj: (co.cnpj as string | null) ?? null,
        saleNumber: sale.number ?? null,
        items: itemList.map((it) => ({
          description:
            it.description ??
            (it.product_id ? (byId.get(it.product_id)?.name ?? "Item") : "Item"),
          quantity: Number(it.quantity ?? 0),
          unitPrice: Number(it.unit_price ?? 0),
          total: Number(it.total ?? 0),
          ncm: it.product_id ? (byId.get(it.product_id)?.ncm ?? null) : null,
        })),
      },

    };
  });

// ---------- Contexto do documento (cliente + CFOP para painel lateral)

export interface FiscalDocumentContext {
  customerName: string | null;
  customerDocument: string | null;
  itemCount: number;
  cfop: string | null;
  natureza: string | null;
  saleNumber: number | null;
}

export const getFiscalDocumentContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { documentId: string }) =>
    z.object({ documentId: z.string().uuid() }).strict().parse(input),
  )
  .handler(async ({ data, context }): Promise<FiscalDocumentContext> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.view");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: docRow } = await (docFrom(supabase) as any)
      .select("sale_id")
      .eq("company_id", companyId)
      .eq("id", data.documentId)
      .maybeSingle();
    const saleId = (docRow as { sale_id: string | null } | null)?.sale_id ?? null;

    let customerName: string | null = null;
    let customerDocument: string | null = null;
    let itemCount = 0;
    let saleNumber: number | null = null;

    if (saleId) {
      const { data: sale } = await supabase
        .from("sales")
        .select("number, customer_id")
        .eq("company_id", companyId)
        .eq("id", saleId)
        .maybeSingle();
      const s = sale as unknown as { number: number | null; customer_id: string | null } | null;
      saleNumber = s?.number ?? null;
      if (s?.customer_id) {
        const { data: cust } = await supabase
          .from("customers")
          .select("name, document")
          .eq("company_id", companyId)
          .eq("id", s.customer_id)
          .maybeSingle();
        const c = cust as { name: string | null; document: string | null } | null;
        customerName = c?.name ?? customerName;
        customerDocument = c?.document ?? null;
      }
      const { count } = await supabase
        .from("sale_items")
        .select("id", { count: "exact", head: true })
        .eq("sale_id", saleId);
      itemCount = count ?? 0;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: settings } = await (supabase.from("fiscal_settings" as never) as any)
      .select("default_cfop, operation_nature")
      .eq("company_id", companyId)
      .maybeSingle();
    const st = (settings ?? null) as {
      default_cfop: string | null;
      operation_nature: string | null;
    } | null;

    return {
      customerName,
      customerDocument,
      itemCount,
      cfop: st?.default_cfop ?? null,
      natureza: st?.operation_nature ?? null,
      saleNumber,
    };
  });

// ---------------------------------------------------------------- EXPORT XML
export const exportFiscalXmlsBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { from: string; to: string }) =>
    z.object({ from: z.string(), to: z.string() }).strict().parse(input),
  )
  .handler(async ({ data, context }): Promise<{ name: string; contentBase64: string }[]> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.export");

    // Buscamos apenas notas autorizadas ou canceladas que tenham XML
    const { data: rows, error } = await supabase
      .from("fiscal_documents")
      .select("number, access_key, xml_authorized_path, xml_cancellation_path")
      .eq("company_id", companyId)
      .gte("created_at", data.from)
      .lte("created_at", data.to)
      .or("status.eq.authorized,status.eq.cancelled");

    if (error) throw error;
    if (!rows || rows.length === 0) {
      throw new Error("Nenhum XML encontrado no período selecionado.");
    }

    const files: { name: string; contentBase64: string }[] = [];

    for (const row of rows) {
      // Prioridade para XML autorizado
      const path = row.xml_authorized_path || row.xml_cancellation_path;
      if (!path) continue;

      try {
        const { data: blob, error: downloadErr } = await supabase.storage
          .from("fiscal_artifacts")
          .download(path);

        if (downloadErr || !blob) continue;

        const buffer = await blob.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        
        const fileName = `${row.access_key || row.number || "nota"}.xml`;
        files.push({ name: fileName, contentBase64: base64 });
      } catch (err) {
        console.error(`Falha ao baixar XML: ${path}`, err);
      }
    }

    if (files.length === 0) {
      throw new Error("Nenhum arquivo XML pôde ser baixado.");
    }

    return files;
  });

