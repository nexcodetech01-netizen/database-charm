/**
 * Public OAuth callback for the Meta (Facebook Login) integration.
 *
 * Meta redirects the browser here with ?code=...&state=... after the user
 * approves the consent screen. We verify the signed state, exchange the code
 * for a long-lived token, fetch the profile (business/page/IG/catalog) and
 * upsert it, then bounce the browser back to the Meta integration workspace.
 */
import { createFileRoute } from "@tanstack/react-router";
import { enforceRateLimit } from "@/lib/rate-limit.server";

export const Route = createFileRoute("/api/public/meta/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const limited = enforceRateLimit({
          route: "meta:oauth-callback",
          max: 20,
          windowMs: 60_000,
        });
        if (limited) return limited;
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const providerError = url.searchParams.get("error");
        const errorReason =
          url.searchParams.get("error_description") ??
          url.searchParams.get("error_reason") ??
          providerError;

        const redirectBack = (params: Record<string, string>) => {
          const target = new URL("/configuracoes/integracoes/meta", url.origin);
          for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
          return new Response(null, { status: 302, headers: { Location: target.toString() } });
        };

        if (providerError || !code || !state) {
          return redirectBack({
            meta_status: "error",
            meta_error: errorReason ?? "missing_code_or_state",
          });
        }

        try {
          const { verifyState } = await import("@/lib/meta-crypto.server");
          const {
            exchangeCodeForToken,
            upgradeToLongLivedToken,
            fetchMetaProfile,
            upsertMetaIntegration,
          } = await import("@/lib/meta-graph.server");

          const payload = verifyState(state);
          const redirectUri = `${url.origin}/api/public/meta/oauth/callback`;

          const short = await exchangeCodeForToken({ code, redirectUri });
          let userAccessToken = short.access_token;
          let expiresIn: number | null = short.expires_in ?? null;

          try {
            const long = await upgradeToLongLivedToken(userAccessToken);
            userAccessToken = long.access_token;
            expiresIn = long.expires_in ?? expiresIn;
          } catch {
            /* keep short-lived token if upgrade fails */
          }

          const profile = await fetchMetaProfile(userAccessToken);
          await upsertMetaIntegration({
            companyId: payload.companyId,
            userId: payload.userId,
            userAccessToken,
            expiresIn,
            profile,
          });

          return redirectBack({ meta_status: "connected" });
        } catch (err) {
          const message = err instanceof Error ? err.message : "unknown_error";
          console.error("[meta oauth callback]", message);
          return redirectBack({ meta_status: "error", meta_error: message });
        }
      },
    },
  },
});
