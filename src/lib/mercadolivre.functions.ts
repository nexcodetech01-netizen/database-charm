/**
 * TanStack server functions for the Mercado Livre integration.
 * Per-tenant OAuth2 (each company brings its own ML app credentials).
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCompanyId } from "@/lib/company-resolver.server";

const CALLBACK_PATH = "/mercadolivre/callback";

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
      autoRefresh: false,
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
