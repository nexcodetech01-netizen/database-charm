/**
 * TanStack server functions for the Meta (Facebook + Instagram) integration.
 * Scope: META-001 (OAuth + identify + persist tokens).
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCompanyId } from "@/lib/company-resolver.server";

const CALLBACK_PATH = "/api/public/meta/oauth/callback";

function buildRedirectUri(): string {
  const explicit = process.env.META_OAUTH_REDIRECT_URI;
  if (explicit) return explicit;
  const host = getRequestHost();
  const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  return `${proto}://${host}${CALLBACK_PATH}`;
}

/**
 * Empresa ativa do usuário. RC.0.2: delega ao resolver oficial, que só
 * devolve empresa com vínculo real (owner ou user_roles) — nunca confia
 * em `profiles.current_company_id` isoladamente.
 */
async function requireCurrentCompanyId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<string> {
  try {
    return await resolveCompanyId(supabase, userId);
  } catch {
    throw new Error("Nenhuma empresa ativa. Complete o onboarding antes de conectar a Meta.");
  }
}

/** Returns the OAuth authorization URL the browser must open. */
export const startMetaOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { buildAuthorizeUrl, requireMetaAppEnv } = await import("./meta-graph.server");
    const { signState } = await import("./meta-crypto.server");
    requireMetaAppEnv();
    const companyId = await requireCurrentCompanyId(context.supabase, context.userId);
    const state = signState({ companyId, userId: context.userId });
    const authorizationUrl = buildAuthorizeUrl({
      redirectUri: buildRedirectUri(),
      state,
    });
    return { authorizationUrl };
  });

/** Returns the current integration summary for the caller's company. */
export const getMetaIntegration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getIntegrationSummary } = await import("./meta-graph.server");
    const companyId = await requireCurrentCompanyId(context.supabase, context.userId);
    return getIntegrationSummary(companyId);
  });

/** Re-fetches Business/Page/IG/Catalog data from Meta and upserts. */
export const refreshMetaIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { refreshCompanyIntegration, getIntegrationSummary } = await import("./meta-graph.server");
    const companyId = await requireCurrentCompanyId(context.supabase, context.userId);
    await refreshCompanyIntegration(companyId);
    return getIntegrationSummary(companyId);
  });

/** Disconnects Meta for the caller's company (drops stored tokens). */
export const disconnectMetaIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { deleteCompanyIntegration } = await import("./meta-graph.server");
    const companyId = await requireCurrentCompanyId(context.supabase, context.userId);
    await deleteCompanyIntegration(companyId);
    return { ok: true };
  });
