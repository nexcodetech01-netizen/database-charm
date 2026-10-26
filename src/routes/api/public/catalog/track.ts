import { createFileRoute } from "@tanstack/react-router";
import { enforceRateLimit } from "@/lib/rate-limit.server";
import { trackCatalogEvent } from "@/features/catalog/lib/track-event.server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export const Route = createFileRoute("/api/public/catalog/track")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const limited = enforceRateLimit(
          { route: "catalog:track", max: 120, windowMs: 60_000 },
          cors,
        );
        if (limited) return limited;
        try {
          const text = await request.text();
          if (text.length > 2000) return new Response(null, { status: 413, headers: cors });
          await trackCatalogEvent(JSON.parse(text || "{}"));
        } catch {
          // Métrica nunca derruba nada: sempre responde 204.
        }
        return new Response(null, { status: 204, headers: cors });
      },
    },
  },
});
