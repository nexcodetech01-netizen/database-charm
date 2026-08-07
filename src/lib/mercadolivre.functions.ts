/**
 * TanStack server functions for the Mercado Livre integration.
 * Per-tenant OAuth2 (each company brings its own ML app credentials).
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCompanyId } from "@/lib/company-resolver.server";

const CALLBACK_PATH = "/api/public/mercadolivre/oauth/callback";

function buildRedirectUri(): string {
  const explicit = process.env.MERCADOLIVRE_OAUTH_REDIRECT_URI;
  if (explicit) return explicit;
  const host = getRequestHost();
  const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  return `${proto}://${host}${CALLBACK_PATH}`;
}

/**
 * Empresa ativa do usuário. RC.0.2: delega ao resolver oficial, que exige
 * vínculo real (owner ou user_roles).
 */
async function requireCurrentCompanyId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<string> {
  try {
    return await resolveCompanyId(supabase, userId);
  } catch {
    throw new Error(
      "Nenhuma empresa ativa. Complete o onboarding antes de conectar o Mercado Livre.",
    );
  }
}

/** Saves per-tenant Client ID / Secret for the caller's company. */
export const saveMercadoLivreCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; clientSecret?: string | null }) => {
    const clientId = String(input?.clientId ?? "").trim();
    const rawSecret = input?.clientSecret;
    const clientSecret =
      rawSecret == null ? null : String(rawSecret).trim() || null;
    if (!clientId) throw new Error("Client ID (App ID) é obrigatório.");
    return { clientId, clientSecret };
  })
  .handler(async ({ data, context }) => {
    const { saveCredentials } = await import("./mercadolivre.server");
    const companyId = await requireCurrentCompanyId(context.supabase, context.userId);
    await saveCredentials(context.supabase, {
      companyId,
      userId: context.userId,
      clientId: data.clientId,
      clientSecret: data.clientSecret,
    });
    return { ok: true, redirectUri: buildRedirectUri() };
  });


/** Returns the OAuth authorization URL for the ML consent screen. */
export const startMercadoLivreOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getCompanyCredentials, buildAuthorizeUrl } = await import("./mercadolivre.server");
    const { signState } = await import("./meta-crypto.server");
    const companyId = await requireCurrentCompanyId(context.supabase, context.userId);
    const creds = await getCompanyCredentials(context.supabase, companyId);
    if (!creds) {
      throw new Error(
        "Salve o Client ID e Client Secret do Mercado Livre antes de autorizar.",
      );
    }
    const state = signState({ companyId, userId: context.userId });
    const authorizationUrl = buildAuthorizeUrl({
      clientId: creds.clientId,
      redirectUri: buildRedirectUri(),
      state,
    });
    return { authorizationUrl, redirectUri: buildRedirectUri() };
  });

export const getMercadoLivreIntegration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getIntegrationSummary } = await import("./mercadolivre.server");
    const companyId = await requireCurrentCompanyId(context.supabase, context.userId);
    const summary = await getIntegrationSummary(context.supabase, companyId, {
      userId: context.userId,
      autoRefresh: true,
    });
    return { ...summary, redirectUri: buildRedirectUri() };
  });

export const disconnectMercadoLivre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { deleteIntegration } = await import("./mercadolivre.server");
    const companyId = await requireCurrentCompanyId(context.supabase, context.userId);
    await deleteIntegration(context.supabase, companyId);
    return { ok: true };
  });

export const syncMercadoLivreProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { syncMLProducts } = await import("./mercadolivre.server");
    const companyId = await requireCurrentCompanyId(context.supabase, context.userId);
    const result = await syncMLProducts(context.supabase, companyId, context.userId);
    return result;
  });

export const getMercadoLivreCategoryAttributes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { categoryId: string }) => {
    const categoryId = String(input?.categoryId ?? "").trim();
    if (!categoryId) throw new Error("categoryId obrigatório.");
    return { categoryId };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { getIntegrationSummary } = await import("./mercadolivre.server");
    const companyId = await resolveCompanyId(supabase, userId);
    const summary = await getIntegrationSummary(supabase, companyId, {
      userId,
      autoRefresh: true,
    });
    
    if (!summary.connected) throw new Error("Integração não conectada.");

    const { data: row } = await supabase
      .from("mercadolivre_integrations")
      .select("access_token_encrypted")
      .eq("company_id", companyId)
      .maybeSingle();

    if (!row?.access_token_encrypted) throw new Error("Token não encontrado.");

    const { decryptToken } = await import("./meta-crypto.server");
    const token = decryptToken(row.access_token_encrypted);
    if (!token) throw new Error("Falha ao decifrar token.");

    const res = await fetch(
      `https://api.mercadolibre.com/categories/${data.categoryId}/attributes`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      }
    );
    
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Falha ao buscar atributos (${res.status}): ${text}`);
    }

    return await res.json();
  });

export const getMercadoLivreOrderLabel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mlOrderId: string }) => {
    const mlOrderId = String(input?.mlOrderId ?? "").trim();
    if (!mlOrderId) throw new Error("mlOrderId obrigatório.");
    return { mlOrderId };
  })
  .handler(async ({ data, context }) => {
    const { getOrderLabel } = await import("./mercadolivre.server");
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    return await getOrderLabel(context.supabase, companyId, data.mlOrderId);
  });

