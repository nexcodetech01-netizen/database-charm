/**
 * Public webhook endpoint for Meta WhatsApp Business Cloud API.
 *
 * GET  — subscription verification handshake (hub.mode/verify_token/challenge).
 * POST — receives message/status events. We validate the app secret signature
 *        (X-Hub-Signature-256) and acknowledge with 200 OK. Full message
 *        processing lives in higher-level features and is not scoped here.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { enforceRateLimit } from "@/lib/rate-limit.server";

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const limited = enforceRateLimit({
          route: "whatsapp:webhook-verify",
          max: 30,
          windowMs: 60_000,
        });
        if (limited) return limited;

        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

        console.log("[whatsapp.webhook] GET verify", {
          mode,
          receivedTokenPresent: Boolean(token),
          expectedTokenConfigured: Boolean(expected),
          match: token === expected,
          hasChallenge: Boolean(challenge),
        });

        if (mode === "subscribe" && expected && token === expected && challenge) {
          return new Response(challenge, {
            status: 200,
            headers: { "content-type": "text/plain" },
          });
        }
        return new Response("Forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        // 1) Lê o corpo bruto imediatamente para logar tudo que a Meta enviar.
        const signature = request.headers.get("x-hub-signature-256");
        const raw = await request.text();

        let parsedForLog: unknown = null;
        try {
          parsedForLog = JSON.parse(raw);
        } catch {
          parsedForLog = raw;
        }
        console.log("PAYLOAD RECEBIDO DA META:", JSON.stringify(parsedForLog));

        try {
          // 2) Rate limit + verificação de assinatura (antes de qualquer persistência).
          const limited = enforceRateLimit({
            route: "whatsapp:webhook-event",
            max: 300,
            windowMs: 60_000,
          });
          if (limited) return limited;

          // Fail-closed: sem META_APP_SECRET não há como provar a origem.
          const appSecret = process.env.META_APP_SECRET;
          if (!appSecret) {
            console.error(
              "[whatsapp.webhook] CRÍTICO: META_APP_SECRET ausente — fail-closed (503)",
            );
            return new Response("Webhook signature not configured", { status: 503 });
          }
          if (!signature?.startsWith("sha256=")) {
            return new Response("Missing signature", { status: 401 });
          }
          const expected = "sha256=" + createHmac("sha256", appSecret).update(raw).digest("hex");
          const a = Buffer.from(signature);
          const b = Buffer.from(expected);
          if (a.length !== b.length || !timingSafeEqual(a, b)) {
            return new Response("Invalid signature", { status: 401 });
          }

          // 3) Persiste payload bruto (AWAIT — sem fire-and-forget).
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const payloadJson =
            parsedForLog && typeof parsedForLog === "object" ? parsedForLog : null;
          try {
            const { error: logErr } = await (supabaseAdmin as any)
              .from("whatsapp_webhook_logs")
              .insert({
                signature,
                payload: payloadJson,
                raw_body: raw,
              });
            if (logErr) {
              console.error("[whatsapp.webhook] falha ao gravar log bruto:", logErr);
            }
          } catch (logErr) {
            console.error("[whatsapp.webhook] exceção ao gravar log bruto:", logErr);
          }

          // 4) Faz o parse do payload estruturado.
          let payload: Record<string, unknown> | null = null;
          try {
            payload = JSON.parse(raw) as Record<string, unknown>;
          } catch {
            return new Response("EVENT_RECEIVED", { status: 200 });
          }

          // 5) Processa mensagens/status AGUARDANDO (sem fire-and-forget).
          try {
            const { handleWhatsAppInboundPayload } =
              await import("@/features/whatsapp/inbound/router.server");
            await handleWhatsAppInboundPayload(payload);
          } catch (err) {
            console.error("Erro ao processar mensagem do Webhook:", err);
          }

          // 6) Sempre responde 200 EVENT_RECEIVED para a Meta não reenviar.
          return new Response("EVENT_RECEIVED", { status: 200 });
        } catch (error) {
          console.error("Erro ao processar mensagem do Webhook:", error);
          return new Response("EVENT_RECEIVED", { status: 200 });
        }
      },
    },
  },
});
