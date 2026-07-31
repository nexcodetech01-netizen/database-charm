/**
 * Serve o QR Code PIX de uma cobrança Bella Pay como PNG público.
 *
 * Necessário porque o header de imagem de templates WhatsApp (Meta) exige
 * uma URL HTTPS pública — não aceita base64. Só expõe o QR (não é PII);
 * o corpo do template continua trafegando `pixPayload` como copia-e-cola.
 */
import { createFileRoute } from "@tanstack/react-router";
import { enforceRateLimit } from "@/lib/rate-limit.server";

export const Route = createFileRoute("/api/public/bella-pay/qr/$chargeId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        // Hardening: endpoint público e enumerável — limita scraping por IP.
        const limited = enforceRateLimit({ route: "bella-pay:qr", windowMs: 60_000, max: 30 });
        if (limited) return limited;

        const chargeId = String(params.chargeId ?? "").replace(/\.png$/i, "");
        if (!/^[0-9a-f-]{16,}$/i.test(chargeId)) {
          return new Response("invalid_id", { status: 400 });
        }
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const { data, error } = await supabaseAdmin
          .from("bella_pay_charges")
          .select("pix_qr_code")
          .eq("id", chargeId)
          .maybeSingle();
        if (error || !data?.pix_qr_code) {
          return new Response("not_found", { status: 404 });
        }
        try {
          const raw = data.pix_qr_code.replace(/^data:image\/\w+;base64,/i, "");
          const bytes = Buffer.from(raw, "base64");
          return new Response(bytes, {
            status: 200,
            headers: {
              "content-type": "image/png",
              "cache-control": "public, max-age=3600, s-maxage=3600",
              "content-length": String(bytes.length),
            },
          });
        } catch {
          return new Response("decode_error", { status: 500 });
        }
      },
    },
  },
});
