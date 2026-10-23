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
        // 1) Rate limit ANTES de ler o corpo.
        const limited = enforceRateLimit({
          route: "whatsapp:webhook-event",
          max: 300,
          windowMs: 60_000,
        });
        if (limited) return limited;

        // 2) Fail-closed: sem META_APP_SECRET não há como provar que o evento
        //    veio da Meta, então nada é processado (antes aceitava qualquer POST).
        const appSecret = process.env.META_APP_SECRET;
        if (!appSecret) {
          console.error(
            "[whatsapp.webhook] CRÍTICO: META_APP_SECRET ausente — evento recusado (fail-closed).",
          );
          return new Response("Webhook not configured", { status: 503 });
        }

        const signature = request.headers.get("x-hub-signature-256");
        const raw = await request.text();

        let parsedForLog: unknown = null;
        try {
          parsedForLog = JSON.parse(raw);
        } catch {
          parsedForLog = raw;
        }

        try {
          // 2.1) Verificação de assinatura (HMAC SHA-256) — obrigatória.
          if (!signature?.startsWith("sha256=")) {
            console.error("[whatsapp.webhook] Assinatura ausente.");
            return new Response("Missing signature", { status: 401 });
          }

          const expected = "sha256=" + createHmac("sha256", appSecret).update(raw).digest("hex");
          const a = Buffer.from(signature);
          const b = Buffer.from(expected);

          if (a.length !== b.length || !timingSafeEqual(a, b)) {
            console.error("[whatsapp.webhook] Assinatura inválida detectada.");
            return new Response("Invalid signature", { status: 401 });
          }

          // Log só com metadados — nunca o conteúdo (telefone/texto do cliente, LGPD).
          {
            const p = parsedForLog as { object?: unknown; entry?: Array<{ changes?: Array<{ value?: { messages?: unknown[]; statuses?: unknown[] } }> }> } | null;
            const value = p?.entry?.[0]?.changes?.[0]?.value;
            console.log(
              "[whatsapp.webhook] evento recebido",
              JSON.stringify({
                object: typeof p?.object === "string" ? p.object : null,
                entryCount: Array.isArray(p?.entry) ? p.entry.length : 0,
                hasMessages: Array.isArray(value?.messages) && value.messages.length > 0,
                hasStatuses: Array.isArray(value?.statuses) && value.statuses.length > 0,
              }),
            );
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

          // 5) Processa TODOS os eventos do POST (a Meta agrupa vários em um
          //    só). Falha em um evento vai para a DLQ sem derrubar os demais.
          //    (Auditoria 4.3 — antes só entry[0].changes[0].messages[0].)
          try {
            const { extractWhatsAppEvents } = await import(
              "@/features/whatsapp/inbound/webhook-events"
            );
            const { processWhatsAppEvents } = await import(
              "@/features/whatsapp/inbound/webhook-processor.server"
            );
            const events = extractWhatsAppEvents(payload);
            const summary = await processWhatsAppEvents(events, { db: supabaseAdmin });
            console.log("[whatsapp.webhook] processado", JSON.stringify(summary));
          } catch (err) {
            // Falha inesperada antes de processar (ex.: import): guarda o POST
            // inteiro na DLQ para não perder mensagens.
            console.error("[whatsapp.webhook] erro inesperado ao processar lote:", err);
            const { recordDeadLetter } = await import("@/lib/dead-letter.server");
            await recordDeadLetter({
              source: "whatsapp",
              topic: "batch",
              reference: null,
              payload,
              errorMessage: err instanceof Error ? err.message : String(err),
            });
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
