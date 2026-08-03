/**
 * Public OAuth callback for the Mercado Livre integration.
 *
 * Dois modos de uso:
 * - GET  → chamado direto pelo ML (fluxo legado). Faz troca e redireciona.
 * - POST → chamado pela SPA em /mercadolivre/callback com { code, state }.
 *          Retorna JSON para a página exibir sucesso/erro.
 */
import { createFileRoute } from "@tanstack/react-router";
import { enforceRateLimit } from "@/lib/rate-limit.server";

const FRONTEND_CALLBACK_PATH = "/mercadolivre/callback";

function resolveRedirectUri(origin: string): string {
  return (
    process.env.MERCADOLIVRE_OAUTH_REDIRECT_URI ??
    `${origin}${FRONTEND_CALLBACK_PATH}`
  );
}

async function exchange(params: {
  code: string;
  state: string;
  origin: string;
  request: Request;
}) {
  const { verifyState } = await import("@/lib/meta-crypto.server");
  const {
    getCompanyCredentialsAdmin,
    exchangeCodeForToken,
    upsertTokens,
  } = await import("@/lib/mercadolivre.server");

  const payload = verifyState(params.state);
  const authenticatedClient = await getAuthenticatedClient(
    params.request,
    payload.userId,
  );
  const creds = await getCompanyCredentialsAdmin(
    payload.companyId,
    authenticatedClient,
  );
  if (!creds) throw new Error("Credenciais Mercado Livre não encontradas.");

  const token = await exchangeCodeForToken({
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
    code: params.code,
    redirectUri: resolveRedirectUri(params.origin),
  });

  await upsertTokens({
    companyId: payload.companyId,
    userId: payload.userId,
    token,
    supabase: authenticatedClient,
  });
}

async function getAuthenticatedClient(request: Request, expectedUserId: string) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  const token = authorization.slice("Bearer ".length).trim();
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !publishableKey) return null;

  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user || data.user.id !== expectedUserId) return null;
  return client;
}

export const Route = createFileRoute("/api/public/mercadolivre/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const limited = enforceRateLimit({
          route: "mercadolivre:oauth-callback",
          max: 20,
          windowMs: 60_000,
        });
        if (limited) return limited;

        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        
        console.log(`[ML_CALLBACK_DEBUG] URL: ${url.pathname}${url.search}`);
        console.log(`[ML_CALLBACK_DEBUG] Params: code=${code ? 'present' : 'missing'}, state=${state ? 'present' : 'missing'}`);

        const providerError = url.searchParams.get("error");
        const errorReason =
          url.searchParams.get("error_description") ??
          url.searchParams.get("error_reason") ??
          providerError;

        const redirectBack = (params: Record<string, string>) => {
          const target = new URL("/configuracoes/integracoes", url.origin);
          for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
          return new Response(null, {
            status: 302,
            headers: { Location: target.toString() },
          });
        };

        if (providerError || !code || !state) {
          return redirectBack({
            ml_status: "error",
            ml_error: errorReason ?? "missing_code_or_state",
          });
        }

        try {
          await exchange({ code, state, origin: url.origin, request });
          return redirectBack({ ml_status: "connected" });
        } catch (err) {
          const message = err instanceof Error ? err.message : "unknown_error";
          console.error("[mercadolivre oauth callback GET]", message);
          return redirectBack({ ml_status: "error", ml_error: message });
        }
      },

      POST: async ({ request }) => {
        const limited = enforceRateLimit({
          route: "mercadolivre:oauth-callback",
          max: 20,
          windowMs: 60_000,
        });
        if (limited) return limited;

        const url = new URL(request.url);
        const cors = {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Content-Type": "application/json",
        };

        let body: { code?: string; state?: string } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return new Response(
            JSON.stringify({ ok: false, error: "invalid_json_body" }),
            { status: 400, headers: cors },
          );
        }

        const code = body.code?.trim();
        const state = body.state?.trim();
        if (!code || !state) {
          return new Response(
            JSON.stringify({ ok: false, error: "missing_code_or_state" }),
            { status: 400, headers: cors },
          );
        }

        try {
          await exchange({ code, state, origin: url.origin, request });
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: cors,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "unknown_error";
          console.error("[mercadolivre oauth callback POST]", message);
          return new Response(
            JSON.stringify({ ok: false, error: message }),
            { status: 400, headers: cors },
          );
        }
      },

      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }),
    },
  },
});
