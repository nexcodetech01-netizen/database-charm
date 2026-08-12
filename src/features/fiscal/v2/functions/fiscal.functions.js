/**
 * Sprint 007.2 — Server functions do módulo Fiscal.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCompanyId } from "@/lib/company-resolver.server";
import { z } from "zod";
import { toCustomerReference } from "@/lib/customer-reference";
import { mapDocument as mapDocFromQuery } from "../queries/documents.query";
import { FISCAL_DOCUMENT_COLUMNS } from "../lib/document-columns";
import { DocumentsRepository } from "../repositories/documents.repository";
import { CertificateRepository } from "../repositories/certificate.repository";
import { CompanyRepository } from "../repositories/company.repository";
import { ProductsRepository } from "../repositories/products.repository";
import { CustomersRepository } from "../repositories/customers.repository";
import { StatusRepository } from "../repositories/status.repository";
import { TaxRepository } from "../repositories/tax.repository";
import { SalesRepository } from "../repositories/sales.repository";
import { fiscalEnvironmentSchema } from "../types/environment";
import { resolveItemTaxes } from "../lib/item-taxes";
import { buildProviderHealthItems, summarizeProviderHealth, } from "../lib/provider-health";
import { CRT_NOT_CONFIGURED_MESSAGE, crtCoherenceMessage, isCrtCoherent, } from "../lib/crt";
import { blocksNewFiscalDocument, resolveActiveFiscalDocument, resolveFiscalBadgeKey, } from "../lib/fiscal-status";
/** Normaliza linhas de `fiscal_documents` para o formato do helper único. */
function toDocLikes(rows) {
    return (rows ?? []).map((d) => ({
        status: d.status,
        accessKey: d.access_key ?? null,
        protocol: d.protocol ?? null,
        createdAt: d.created_at ?? null,
    }));
}
// ------------------------------------------------------------------ helpers
async function ensurePermission(supabase, userId, companyId, code) {
    const repo = new CompanyRepository(supabase);
    const hasPermission = await repo.hasPermission(userId, companyId, code);
    if (!hasPermission)
        throw new Error(`Acesso negado: ${code}`);
}
const mapDocument = (row) => mapDocFromQuery(row);
const DOC_COLS = FISCAL_DOCUMENT_COLUMNS;
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
    .inputValidator((input) => listSchema.parse(input ?? {}))
    .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.view");
    return new DocumentsRepository(supabase).list(companyId, data);
});
export const getFiscalDashboard = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .handler(async ({ context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.view");
    const docRepo = new DocumentsRepository(supabase);
    const rows = await docRepo.getDashboard(companyId);
    const totals = {
        draft: 0, validating: 0, signing: 0, sending: 0, authorized: 0,
        rejected: 0, cancelling: 0, cancelled: 0, error: 0, discarded: 0,
    };
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    let monthAuthorized = 0;
    let monthValue = 0;
    const list = (rows ?? []);
    list.forEach((r) => {
        totals[r.status] = (totals[r.status] ?? 0) + 1;
        if (r.status === "authorized" && r.protocol_at && r.protocol_at >= monthStart) {
            monthAuthorized += 1;
            monthValue += Number(r.total_amount ?? 0);
        }
    });
    const lastDocument = await docRepo.findLast(companyId);
    return {
        totals,
        monthAuthorized,
        monthValue,
        lastDocument,
    };
});
// -------------------------------------------------------------- DOC + HIST
export const getFiscalDocument = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((input) => z.object({ documentId: z.string().uuid() }).strict().parse(input))
    .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.view");
    const docRepo = new DocumentsRepository(supabase);
    const [document, events] = await Promise.all([
        docRepo.findById(companyId, data.documentId),
        docRepo.fetchEvents(companyId, data.documentId),
    ]);
    if (!document)
        throw new Error("Documento fiscal não encontrado.");
    return { document, events };
});
// ------------------------------------------------------------------ ISSUE
// Cria um documento em rascunho para a venda informada e registra o
// evento inicial. A ligação com um provedor fiscal real acontece na
// Sprint 007.3 (integração SEFAZ).
export const issueFiscalFromSale = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((input) => z
    .object({
    saleId: z.string().uuid(),
    environment: fiscalEnvironmentSchema.optional(),
    // 55 = NF-e (default) · 65 = NFC-e (PDV). Mesmo motor.
    model: z.enum(["55", "65"]).optional(),
})
    .strict()
    .parse(input))
    .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.create");
    // Valida a venda pertence à empresa.
    const salesRepo = new SalesRepository(supabase);
    const saleExists = await salesRepo.exists(companyId, data.saleId);
    if (!saleExists)
        throw new Error("Venda não encontrada.");
    // Impede duplicidade usando Repository.
    const repo = new DocumentsRepository(supabase);
    const existingDocs = await repo.findBySaleId(companyId, data.saleId);
    if (blocksNewFiscalDocument(toDocLikes(existingDocs))) {
        throw new Error(data.model === "65"
            ? "Já existe uma NFC-e ativa para esta venda."
            : "Já existe uma NF-e ativa para esta venda.");
    }
    // Motor real: validação → certificado A1 → provider → persistência.
    const { issueNfeFromSaleEngine } = await import("./nfe-engine.server");
    const doc = await issueNfeFromSaleEngine({
        supabase: supabase,
        companyId,
        userId: context.userId,
        saleId: data.saleId,
        environment: data.environment,
        model: data.model,
    });
    return doc;
});
// ----------------------------------------------------------------- CANCEL
export const cancelFiscalDocument = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((input) => z
    .object({
    documentId: z.string().uuid(),
    reason: z.string().min(15).max(255),
})
    .strict()
    .parse(input))
    .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");
    const { cancelDocumentEngine } = await import("./nfe-engine.server");
    const updated = await cancelDocumentEngine({
        supabase: supabase,
        companyId,
        userId: context.userId,
        documentId: data.documentId,
        reason: data.reason,
    });
    return updated;
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
    .inputValidator((input) => z
    .object({
    documentId: z.string().uuid(),
    reason: z.string().trim().min(3).max(255).optional(),
})
    .strict()
    .parse(input))
    .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");
    const repo = new DocumentsRepository(supabase);
    const current = await repo.findById(companyId, data.documentId);
    if (!current)
        throw new Error("Documento fiscal não encontrado.");
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
        throw new Error("Documento já possui chave/protocolo na SEFAZ — descarte indisponível.");
    if (!(row.status === "error" || row.status === "rejected"))
        throw new Error(`Somente tentativas com erro podem ser descartadas (status atual: ${row.status}).`);
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
    .inputValidator((input) => z.object({ documentId: z.string().uuid() }).strict().parse(input))
    .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.view");
    const { refreshDocumentStatusEngine } = await import("./nfe-engine.server");
    const row = await refreshDocumentStatusEngine({
        supabase: supabase,
        companyId,
        userId: context.userId,
        documentId: data.documentId,
    });
    return row;
});
/**
 * Reprocessa artefatos fiscais pendentes (XML autorizado, DANFE, XML de
 * cancelamento). Nunca reenvia a NF-e à SEFAZ — apenas recupera arquivos
 * do provedor. Execução idempotente.
 */
export const reprocessFiscalArtifacts = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((input) => z.object({ documentId: z.string().uuid() }).strict().parse(input))
    .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.update");
    const { reprocessDocumentArtifactsEngine } = await import("./nfe-engine.server");
    const outcome = await reprocessDocumentArtifactsEngine({
        supabase: supabase,
        companyId,
        userId: context.userId,
        documentId: data.documentId,
    });
    return {
        document: outcome.document,
        recovered: outcome.recovered,
        stillPending: outcome.stillPending,
        noop: outcome.noop,
        message: outcome.message,
    };
});
// ----------------------------------------------------- ARTIFACT signed URL
export const getFiscalArtifactUrl = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((input) => z
    .object({ path: z.string().min(3) })
    .strict()
    .parse(input))
    .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.view");
    if (!data.path.startsWith(`${companyId}/`)) {
        throw new Error("Caminho fora do escopo da empresa.");
    }
    const docRepo = new DocumentsRepository(supabase);
    const url = await docRepo.createArtifactSignedUrl(data.path, 60);
    return { url };
});
const PROVIDER_COLS = "provider_id, environment, api_url, notes, webhook_url," +
    " last_health_check_at, last_health_status, last_health_message, updated_at," +
    " provisioned_at, provisioned_environment, provisioned_certificate_id, provisioned_note";
async function fetchHasSecretKind(supabase, companyId, kind, environment) {
    const repo = new StatusRepository(supabase);
    return repo.hasSecret(companyId, kind, environment);
}
/** Token de EMPRESA (emissão). Mantido por compatibilidade de nome. */
function fetchHasApiKey(supabase, companyId, environment) {
    return fetchHasSecretKind(supabase, companyId, "provider_api_key", environment);
}
/** Token PRINCIPAL (administrativo). */
function fetchHasAdminKey(supabase, companyId, environment) {
    return fetchHasSecretKind(supabase, companyId, "provider_admin_key", environment);
}
const PROVIDER_ENV_COLS = "environment, api_url, provisioned_at, provisioned_environment," +
    " provisioned_certificate_id, provisioned_note," +
    " last_health_check_at, last_health_status, last_health_message";
function emptyEnvConfig(environment) {
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
async function fetchEnvironments(supabase, companyId) {
    const repo = new StatusRepository(supabase);
    const rows = await repo.getProviderEnvironments(companyId);
    const out = {
        production: emptyEnvConfig("production"),
        homologation: emptyEnvConfig("homologation"),
    };
    for (const env of ["production", "homologation"]) {
        const row = rows.find((r) => r.environment === env) ?? null;
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
function mapProvider(row, hasApiKey, environments) {
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
        provisionedEnvironment: active.provisionedEnvironment ?? row.provisioned_environment ?? null,
        provisionedCertificateId: active.provisionedCertificateId ?? row.provisioned_certificate_id ?? null,
        provisionedNote: active.provisionedNote ?? row.provisioned_note ?? null,
        environments,
    };
}
export const getFiscalProviderConfig = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .handler(async ({ context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.view");
    const statusRepo = new StatusRepository(supabase);
    const data = await statusRepo.getProviderRow(companyId, PROVIDER_COLS);
    const hasKey = await fetchHasApiKey(supabase, companyId);
    const environments = await fetchEnvironments(supabase, companyId);
    return mapProvider((data ?? null), hasKey, environments);
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
function normalizeUrlInput(value) {
    if (typeof value !== "string")
        return null;
    const raw = value.trim().replace(/\/+$/, "");
    if (!raw)
        return null;
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
        return new URL(withScheme).toString().replace(/\/+$/, "");
    }
    catch {
        throw new Error(`URL inválida: ${value}`);
    }
}
export const updateFiscalProviderConfig = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((input) => providerUpdateSchema.parse(input))
    .handler(async ({ data, context }) => {
    const supabase = context.supabase;
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
    const statusRepo = new StatusRepository(supabase);
    // UPDATE explícito + INSERT de fallback: o upsert do PostgREST dependia da
    // resolução de conflito e mascarava falhas silenciosas de persistência.
    let row = (await statusRepo.updateProviderConfig(companyId, payload, PROVIDER_COLS));
    if (!row) {
        row = (await statusRepo.insertProviderConfig(payload, PROVIDER_COLS));
    }
    // Read-back: garante que api_url foi realmente gravada (RLS/trigger podem
    // devolver linha sem persistir o valor esperado).
    const verify = await statusRepo.getProviderRow(companyId, PROVIDER_COLS);
    const persisted = (verify ?? row);
    if ((persisted?.api_url ?? null) !== payload.api_url) {
        throw new Error("A URL da API não foi persistida (verifique permissões fiscal.manage desta empresa).");
    }
    // ---- Credenciais/URLs por ambiente (independentes) --------------------
    const { upsertProviderEnvironment } = await import("./nfe-engine.server");
    // Compatibilidade: apiUrl/apiKey "soltos" valem para o ambiente ativo.
    const perEnv = {
        [data.environment]: {
            apiUrl: payload.api_url,
            apiKey: typeof data.apiKey === "string" ? data.apiKey : undefined,
        },
        ...(data.environments ?? {}),
    };
    for (const env of ["production", "homologation"]) {
        const patchIn = perEnv[env];
        if (!patchIn)
            continue;
        if (patchIn.apiUrl !== undefined) {
            await upsertProviderEnvironment(supabase, companyId, env, {
                api_url: normalizeUrlInput(patchIn.apiUrl),
                updated_by: context.userId,
            });
        }
        // Token vazio/ausente NUNCA apaga a credencial já gravada do ambiente.
        if (typeof patchIn.apiKey === "string" && patchIn.apiKey.trim().length > 0) {
            await callSetSecret(supabase, companyId, "provider_api_key", null, patchIn.apiKey.trim(), env);
        }
        if (typeof patchIn.adminApiKey === "string" && patchIn.adminApiKey.trim().length > 0) {
            await callSetSecret(supabase, companyId, "provider_admin_key", null, patchIn.adminApiKey.trim(), env);
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
    .inputValidator((input) => provisionSchema.parse(input ?? {}))
    .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");
    const statusRepo = new StatusRepository(supabase);
    const environment = data.environment ?? (await statusRepo.getActiveEnvironment(companyId)) ?? "homologation";
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
    .handler(async ({ context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");
    const { clearProviderProvisioning } = await import("./nfe-engine.server");
    await clearProviderProvisioning(supabase, companyId);
    return { ok: true };
});
function mapCert(row) {
    return {
        id: row.id,
        alias: row.alias,
        subjectName: row.subject_name ?? null,
        subjectCnpj: row.subject_cnpj ?? null,
        issuerName: row.issuer_name ?? null,
        validFrom: row.valid_from ?? null,
        validTo: row.valid_to ?? null,
        serialNumber: row.serial_number ?? null,
        thumbprint: row.thumbprint ?? null,
        isActive: Boolean(row.is_active),
        createdAt: row.created_at,
    };
}
const CERT_COLS = "id, alias, subject_name, subject_cnpj, issuer_name, valid_from, valid_to," +
    " serial_number, thumbprint, is_active, created_at";
export const listFiscalCertificates = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .handler(async ({ context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.view");
    const repo = new CertificateRepository(supabase);
    const data = await repo.list(companyId);
    return data;
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
    .inputValidator((input) => certUploadSchema.parse(input))
    .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");
    // Decodifica base64 → Uint8Array (fileBase64 é apenas o conteúdo binário,
    // sem cabeçalho `data:`)
    const bin = atob(data.fileBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++)
        bytes[i] = bin.charCodeAt(i);
    const objectPath = `${companyId}/certs/${crypto.randomUUID()}.pfx`;
    const repo = new CertificateRepository(supabase);
    await repo.uploadFile(objectPath, bytes, data.contentType);
    await repo.update(companyId, "all", { is_active: false });
    const cert = await repo.insert({
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
    });
    // Troca do A1 invalida o provisionamento: a próxima emissão volta a
    // cadastrar a empresa/certificado no provedor uma única vez.
    const { clearProviderProvisioning } = await import("./nfe-engine.server");
    await clearProviderProvisioning(supabase, companyId);
    return cert;
});
export const deactivateFiscalCertificate = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((input) => z.object({ certificateId: z.string().uuid() }).strict().parse(input))
    .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");
    const repo = new CertificateRepository(supabase);
    await repo.update(companyId, data.certificateId, { is_active: false });
    return { ok: true };
});
function defaultSettings(companyId) {
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
function mapSettings(row, hasCscToken) {
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
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.view");
    const settings = await new TaxRepository(supabase).getSettings(companyId);
    return settings;
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
    if (value.crt == null)
        return;
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
    .inputValidator((input) => settingsSchema.parse(input))
    .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");
    const taxRepo = new TaxRepository(supabase);
    const row = await taxRepo.updateSettings(companyId, {
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
    });
    const statusRepo = new StatusRepository(supabase);
    const hasCsc = await statusRepo.hasSecret(companyId, "csc_token");
    return mapSettings(row, hasCsc);
});
// -------- Secrets vault (AES-256-GCM with FISCAL_SECRETS_KEY) --------
async function encryptSecret(plaintext) {
    const { createCipheriv, randomBytes, createHash } = await import("crypto");
    const raw = process.env.FISCAL_SECRETS_KEY;
    if (!raw)
        throw new Error("FISCAL_SECRETS_KEY não configurada no servidor.");
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
async function callSetSecret(supabase, companyId, kind, ownerId, plaintext, environment) {
    const ciphertext = plaintext && plaintext.length > 0 ? await encryptSecret(plaintext) : null;
    await new StatusRepository(supabase).setSecret({
        companyId,
        kind,
        ownerId,
        ciphertext,
        environment,
    });
    // Read-back obrigatório: garante que o segredo gravado é EXATAMENTE o mesmo
    // que o motor de emissão/diagnóstico consegue recuperar e descriptografar.
    // Sem isso, uma gravação silenciosamente perdida era reportada como sucesso.
    if (!ciphertext)
        return;
    const { readSecret } = await import("./nfe-engine.server");
    let loaded = null;
    let decryptSuccess = false;
    try {
        loaded = await readSecret(companyId, kind, ownerId, environment ?? null);
        decryptSuccess = loaded !== null;
    }
    catch {
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
        throw new Error("O segredo foi gravado mas não pôde ser recuperado/descriptografado. Verifique FISCAL_SECRETS_KEY no servidor.");
    }
}
export const setCertificatePassword = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((input) => z
    .object({
    certificateId: z.string().uuid(),
    password: z.string().min(1).max(200),
})
    .strict()
    .parse(input))
    .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");
    const certExists = await new CertificateRepository(supabase).exists(companyId, data.certificateId);
    if (!certExists)
        throw new Error("Certificado não encontrado.");
    await callSetSecret(supabase, companyId, "cert_password", data.certificateId, data.password);
    return { ok: true };
});
export const setProviderApiKey = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((input) => z
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
    .parse(input))
    .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");
    let environment = data.environment ?? null;
    if (!environment) {
        environment =
            (await new StatusRepository(supabase).getActiveEnvironment(companyId)) ?? "homologation";
    }
    const kind = data.credential === "admin" ? "provider_admin_key" : "provider_api_key";
    await callSetSecret(supabase, companyId, kind, null, data.apiKey, environment);
    return { ok: true };
});
export const setCscToken = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((input) => z
    .object({ token: z.string().max(200).nullable() })
    .strict()
    .parse(input))
    .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");
    await callSetSecret(supabase, companyId, "csc_token", null, data.token);
    return { ok: true };
});
// -------- Delete certificate (only when inactive) --------
export const deleteFiscalCertificate = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((input) => z.object({ certificateId: z.string().uuid() }).strict().parse(input))
    .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");
    // Locate storage path for cleanup
    const repo = new CertificateRepository(supabase);
    const cert = await repo.findById(companyId, data.certificateId);
    if (!cert)
        throw new Error("Certificado não encontrado.");
    if (cert.isActive) {
        throw new Error("Desative o certificado antes de removê-lo.");
    }
    const storagePath = cert.storagePath;
    await repo.deleteViaRpc(data.certificateId);
    if (storagePath) {
        await repo.removeFile(storagePath);
    }
    return { ok: true };
});
/**
 * Diagnostica UM ambiente usando exclusivamente as credenciais/URL dele.
 * Nunca reaproveita token do outro ambiente e nunca mistura Token Principal
 * com Token Empresa: cada credencial é testada no endpoint que lhe compete.
 */
async function runProviderHealth(supabase, companyId, environment) {
    const statusRepo = new StatusRepository(supabase);
    const cfg = await statusRepo.getProviderConfig(companyId);
    const providerId = cfg?.provider_id ?? "mock";
    const { readProviderEnvironment, probeProviderHealthEngine, probeProviderAdminHealthEngine } = await import("./nfe-engine.server");
    const envCfg = await readProviderEnvironment(supabase, companyId, environment);
    const apiUrl = envCfg.apiUrl ?? null;
    const hasCompanyToken = await fetchHasApiKey(supabase, companyId, environment);
    const hasAdminToken = await fetchHasAdminKey(supabase, companyId, environment);
    const certRepo = new CertificateRepository(supabase);
    const certs = await certRepo.list(companyId);
    const activeCert = certs.find((c) => c.isActive);
    // Probes só fazem sentido quando há URL e a credencial correspondente.
    const canProbe = providerId !== "mock" && Boolean(apiUrl);
    let companyProbe = null;
    let adminProbe = null;
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
    if ((cfg?.environment ?? null) === environment) {
        await new StatusRepository(supabase).recordProviderHealth(companyId, status, message);
    }
    return { status, message, checkedAt, items };
}
export const testProviderConnection = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((input) => z
    .object({ environment: fiscalEnvironmentSchema.optional() })
    .strict()
    .parse(input ?? {}))
    .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");
    let environment = data.environment ?? null;
    if (!environment) {
        environment =
            (await new StatusRepository(supabase).getActiveEnvironment(companyId)) ?? "homologation";
    }
    return runProviderHealth(supabase, companyId, environment);
});
/** Testa Produção e Homologação separadamente (cada uma com seu token). */
export const testProviderConnectionAll = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .handler(async ({ context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");
    return {
        production: await runProviderHealth(supabase, companyId, "production"),
        homologation: await runProviderHealth(supabase, companyId, "homologation"),
    };
});
export const getCompanyFiscalProfile = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .handler(async ({ context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.view");
    const companyRepo = new CompanyRepository(supabase);
    return companyRepo.getProfile(companyId);
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
    .inputValidator((input) => companyUpdateSchema.parse(input))
    .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");
    const companyRepo = new CompanyRepository(supabase);
    // Read-back dentro do repository mantém o mesmo shape de retorno.
    return companyRepo.updateProfile(companyId, {
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
    });
});
export const listSalesForFiscal = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((input) => z
    .object({
    search: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    includeAll: z.boolean().optional(),
})
    .strict()
    .parse(input ?? {}))
    .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.view");
    const term = data.search?.trim() ?? "";
    const limit = data.limit ?? 20;
    const includeAll = data.includeAll === true;
    // Com busca ativa varremos uma janela maior e filtramos em memória,
    // pois o filtro cobre também tabelas relacionadas (cliente, itens e produtos).
    const fetchLimit = term ? 400 : limit;
    // Regra fiscal da empresa: emitir somente após o pagamento?
    const taxRepo = new TaxRepository(supabase);
    const onlyPaid = await taxRepo.getIssueOnlyAfterPayment(companyId);
    // O critério de listagem é fiscal, não financeiro: todas as vendas
    // efetivadas entram na lista (exceto rascunhos). O status financeiro
    // só filtra quando a empresa exige pagamento prévio.
    // Em modo depuração (includeAll) nenhum filtro é aplicado — inclusive
    // rascunhos e vendas não elegíveis aparecem, com o motivo do bloqueio.
    const salesRepo = new SalesRepository(supabase);
    const rows = await salesRepo.listForFiscal(companyId, {
        limit: fetchLimit,
        excludeDraft: !includeAll,
        onlyPaid,
    });
    let sales = (rows ?? []);
    const normalize = (v) => v
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR");
    if (term) {
        const needle = normalize(term);
        const digits = term.replace(/\D/g, "");
        sales = sales.filter((s) => {
            const parts = [s.number ?? "", s.customers?.name ?? ""];
            for (const it of s.sale_items ?? []) {
                parts.push(it.description ?? "");
                parts.push(it.products?.name ?? "");
                parts.push(it.products?.sku ?? "");
                parts.push(it.products?.barcode ?? "");
                if (it.products?.sku)
                    parts.push(toCustomerReference(it.products.sku));
            }
            const haystack = normalize(parts.join(" "));
            if (haystack.includes(needle))
                return true;
            if (digits.length >= 3) {
                const doc = (s.customers?.document ?? "").replace(/\D/g, "");
                if (doc && doc.includes(digits))
                    return true;
                if ((s.number ?? "").replace(/\D/g, "").includes(digits))
                    return true;
                for (const it of s.sale_items ?? []) {
                    const bc = (it.products?.barcode ?? "").replace(/\D/g, "");
                    if (bc && bc.includes(digits))
                        return true;
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
    const activeDocBySale = new Map();
    if (ids.length > 0) {
        const docsRepo = new DocumentsRepository(supabase);
        const docs = await docsRepo.listBySaleIds(companyId, ids);
        const bySale = new Map();
        for (const d of (docs ?? [])) {
            if (!d.sale_id)
                continue;
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
            if (active)
                activeDocBySale.set(saleId, active);
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
        const summary = items.length === 0
            ? null
            : items.length === 1
                ? items[0]
                : `${items[0]} +${items.length - 1}`;
        const firstItem = (s.sale_items ?? [])[0];
        const productName = (firstItem?.description ?? "").trim() || (firstItem?.products?.name ?? "").trim() || null;
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
        const fiscalIssues = [];
        const lineCount = (s.sale_items ?? []).length;
        if (lineCount === 0)
            fiscalIssues.push("Venda sem itens.");
        if (!(s.customers?.document ?? "").replace(/\D/g, ""))
            fiscalIssues.push("Cliente sem CPF/CNPJ.");
        const missingNcm = (s.sale_items ?? []).filter((i) => !((i.products?.ncm ?? "").trim())).length;
        if (missingNcm > 0)
            fiscalIssues.push(missingNcm === 1
                ? "1 item sem NCM no cadastro do produto."
                : `${missingNcm} itens sem NCM no cadastro do produto.`);
        if (onlyPaid && s.status !== "paid")
            fiscalIssues.push("Emissão permitida apenas após o pagamento.");
        if (s.status === "draft")
            fiscalIssues.push("Venda em rascunho (não efetivada).");
        // Badge derivado EXCLUSIVAMENTE do documento fiscal ativo; só quando
        // não há documento é que caímos no estado operacional da venda.
        const fiscalStatus = authorized
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
        const canIssue = !saleCancelled &&
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
const simulateSchema = z
    .object({
    saleId: z.string().uuid(),
    environment: fiscalEnvironmentSchema.optional(),
})
    .strict();
export const simulateFiscalIssue = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((input) => simulateSchema.parse(input))
    .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.view");
    const blockers = [];
    const warnings = [];
    const push = (issue) => (issue.severity === "error" ? blockers : warnings).push(issue);
    // 1) Venda + cliente
    const salesRepo = new SalesRepository(supabase);
    const saleRow = await salesRepo.findSummary(companyId, data.saleId);
    if (!saleRow)
        throw new Error("Venda não encontrada.");
    const sale = saleRow;
    let customer = null;
    if (sale.customer_id) {
        const customersRepo = new CustomersRepository(supabase);
        customer = await customersRepo.findFiscalInfo(companyId, sale.customer_id);
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
    }
    else {
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
        }
        else if (customer.state.length !== 2) {
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
    const itemList = await salesRepo.listItems(sale.id);
    if (itemList.length === 0) {
        push({
            id: "items.empty",
            field: "items",
            severity: "error",
            step: "venda",
            title: "Venda sem itens",
            detail: "NF-e precisa de ao menos um item.",
        });
    }
    else {
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
    let itemsNcmSummary = null;
    const byId = new Map();
    const productIds = Array.from(new Set(itemList.map((it) => it.product_id).filter((v) => Boolean(v))));
    if (productIds.length) {
        const productsRepo = new ProductsRepository(supabase);
        const list = await productsRepo.findNcmInfo(companyId, productIds);
        for (const p of list)
            byId.set(p.id, p);
        const missing = itemList
            .map((it) => (it.product_id ? byId.get(it.product_id) : null))
            .filter((p) => Boolean(p))
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
        const codes = Array.from(new Set(list.map((p) => p.ncm).filter(Boolean)));
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
    const companyRepo = new CompanyRepository(supabase);
    const co = (await companyRepo.getProfile(companyId)) || {};
    if (!co.cnpj || !co.ie || !co.address || !co.city || !co.state || !co.zipcode) {
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
    const taxRepo = new TaxRepository(supabase);
    const s = await taxRepo.getSettings(companyId);
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
    }
    else {
        if (!s.defaultCfop)
            push({
                id: "settings.cfop",
                field: "settings.cfop",
                severity: "error",
                step: "regras",
                title: "CFOP padrão ausente",
                detail: "Defina um CFOP padrão (ex: 5102).",
            });
        if (!s.operationNature)
            push({
                id: "settings.nature",
                field: "settings.nature",
                severity: "error",
                step: "regras",
                title: "Natureza da operação ausente",
                detail: "Ex: 'Venda de mercadoria adquirida ou recebida de terceiros'.",
            });
        if (!s.nfeSeries || s.nfeSeries < 1)
            push({
                id: "settings.series",
                field: "settings.series",
                severity: "error",
                step: "regras",
                title: "Série da NF-e não configurada",
                detail: "Defina a série (normalmente 1).",
            });
        if ((s.taxRegime === "simples" || s.taxRegime === "mei") && !s.defaultCsosn)
            push({
                id: "settings.csosn",
                field: "settings.csosn",
                severity: "error",
                step: "regras",
                title: "CSOSN padrão obrigatório",
                detail: s.taxRegime === "mei"
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
        else if (s.tax_regime &&
            !isCrtCoherent(s.tax_regime, s.crt))
            push({
                id: "settings.crt.coherence",
                field: "settings.crt",
                severity: "error",
                step: "regras",
                title: "CRT incompatível com o regime tributário",
                detail: crtCoherenceMessage(s.taxRegime),
                hint: "Revise em Fiscal → Configuração → Regras.",
            });
    }
    // 4.1) Tributos por item — rejeição 745/750 (item sem grupo PIS/COFINS)
    itemList.forEach((it, i) => {
        const taxes = resolveItemTaxes(s?.crt, { cst: s?.defaultCsosn ?? null, amount: Number(it.total ?? 0) }, s?.defaultCsosn ?? null);
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
    const certRepo = new CertificateRepository(supabase);
    const certs = await certRepo.list(companyId);
    const activeCert = certs.find((c) => c.isActive) ?? null;
    let daysLeft = null;
    if (!activeCert) {
        push({
            id: "cert.missing",
            field: "certificate",
            severity: "error",
            step: "certificado",
            title: "Nenhum certificado A1 ativo",
            detail: "Envie um certificado digital A1 válido.",
        });
    }
    else if (activeCert.validTo) {
        daysLeft = Math.round((new Date(activeCert.validTo).getTime() - Date.now()) / 86400000);
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
        const statusRepo = new StatusRepository(supabase);
        const hasCertPwd = await statusRepo.hasSecret(companyId, "cert_password", undefined, activeCert.id);
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
    const statusRepo = new StatusRepository(supabase);
    const providerRow = await statusRepo.getProviderConfig(companyId);
    const providerId = providerRow?.provider_id ?? "mock";
    const apiUrl = providerRow?.api_url ?? null;
    const lastHealth = providerRow?.last_health_status ?? null;
    const hasApiKey = await statusRepo.hasSecret(companyId, "provider_api_key");
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
    }
    else {
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
    const docRepo = new DocumentsRepository(supabase);
    const existingDocs = await docRepo.findBySaleId(companyId, sale.id);
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
    const environment = data.environment ?? s?.defaultEnvironment ?? "homologation";
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
            cfop: s?.defaultCfop ?? null,
            ncm: itemsNcmSummary,
            csosn: s?.defaultCsosn ?? null,
            crt: s?.crt ?? null,
            natureza: s?.operationNature ?? null,
            series: s?.nfeSeries ?? null,
            numberPreview: s?.nfeNextNumber ?? null,
            hasCertificate: Boolean(activeCert),
            certificateAlias: activeCert?.alias ?? null,
            certificateValidTo: activeCert?.validTo ?? null,
            hasProviderKey: Boolean(hasApiKey),
            certificateExpiresIn: daysLeft,
            companyName: co.legalName ?? null,
            companyCnpj: co.cnpj ?? null,
            saleNumber: sale.number ?? null,
            items: itemList.map((it) => ({
                description: it.description ??
                    (it.product_id ? (byId.get(it.product_id)?.name ?? "Item") : "Item"),
                quantity: Number(it.quantity ?? 0),
                unitPrice: Number(it.unit_price ?? 0),
                total: Number(it.total ?? 0),
                ncm: it.product_id ? (byId.get(it.product_id)?.ncm ?? null) : null,
            })),
        },
    };
});
export const getFiscalDocumentContext = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((input) => z.object({ documentId: z.string().uuid() }).strict().parse(input))
    .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.view");
    const docRepo = new DocumentsRepository(supabase);
    const docRow = await docRepo.findById(companyId, data.documentId);
    const saleId = docRow?.saleId ?? null;
    let customerName = null;
    let customerDocument = null;
    let itemCount = 0;
    let saleNumber = null;
    if (saleId) {
        const salesRepo = new SalesRepository(supabase);
        const header = await salesRepo.findHeader(companyId, saleId);
        saleNumber = header?.number ?? null;
        if (header?.customer_id) {
            const customersRepo = new CustomersRepository(supabase);
            const c_local = await customersRepo.findBasic(companyId, header.customer_id);
            customerName = c_local?.name ?? customerName;
            customerDocument = c_local?.document ?? null;
        }
        itemCount = await salesRepo.countItems(saleId);
    }
    const taxRepo = new TaxRepository(supabase);
    const st = await taxRepo.getDefaultCfopAndNature(companyId);
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
    .inputValidator((input) => z.object({ from: z.string(), to: z.string() }).strict().parse(input))
    .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.export");
    // Buscamos apenas notas autorizadas ou canceladas que tenham XML
    const docRepo = new DocumentsRepository(supabase);
    const rows = await docRepo.listXmlPaths(companyId, data.from, data.to);
    if (rows.length === 0) {
        throw new Error("Nenhum XML encontrado no período selecionado.");
    }
    const files = [];
    for (const row of rows) {
        // Prioridade para XML autorizado
        const path = row.xml_authorized_path || row.xml_cancellation_path;
        if (!path)
            continue;
        try {
            const buffer = await docRepo.downloadXmlArtifact(path);
            if (!buffer)
                continue;
            const base64 = Buffer.from(buffer).toString("base64");
            const fileName = `${row.access_key || row.number || "nota"}.xml`;
            files.push({ name: fileName, contentBase64: base64 });
        }
        catch (err) {
            console.error(`Falha ao baixar XML: ${path}`, err);
        }
    }
    if (files.length === 0) {
        throw new Error("Nenhum arquivo XML pôde ser baixado.");
    }
    return files;
});
