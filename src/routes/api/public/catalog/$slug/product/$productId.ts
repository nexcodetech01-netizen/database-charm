import { createFileRoute } from "@tanstack/react-router";
import { enforceRateLimit } from "@/lib/rate-limit.server";
import { loadProductPagePayload } from "@/features/catalog/lib/load-product-page.server";

async function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  };
}

export const Route = createFileRoute(
  "/api/public/catalog/$slug/product/$productId",
)({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: await corsHeaders() }),
      GET: async ({ params, request }) => {
        const limited = enforceRateLimit(
          { route: "catalog:product", max: 60, windowMs: 60_000 },
          await corsHeaders(),
        );
        if (limited) return limited;

        const url = new URL(request.url);
        const isPreview = url.searchParams.get("preview") === "1";

        const headers = {
          ...(await corsHeaders()),
          "content-type": "application/json",
        };

        const result = await loadProductPagePayload({
          slug: params.slug,
          productId: params.productId,
          isPreview,
        });

        if (!result.ok) {
          return new Response(JSON.stringify({ error: result.error }), {
            status: result.status,
            headers,
          });
        }

        return new Response(JSON.stringify(result.payload), {
          status: 200,
          headers: {
            ...headers,
            "cache-control": "public, max-age=60, s-maxage=60",
          },
        });
      },
    },
  },
});
