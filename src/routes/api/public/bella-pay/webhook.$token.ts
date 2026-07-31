import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { type AsaasEvent } from "@/features/bella-pay/lib/event-map";
import {
  decideWebhookEvent,
  type WebhookPayload as AsaasWebhookPayload,
  type ChargeRow,
} from "@/features/bella-pay/lib/webhook-handler";
import { validateAsaasWebhookAccessToken } from "@/features/bella-pay/lib/webhook-auth";
import { enforceRateLimit } from "@/lib/rate-limit.server";

/**
 * Bella Pay (Asaas) — Webhook receiver.
 * URL: /api/public/bella-pay/webhook/{token}
 *
 * HOTFIX-004D — Sem SUPABASE_SERVICE_ROLE_KEY.
 *   Todas as operações privilegiadas passam por 3 RPCs SECURITY DEFINER:
 *     • bella_pay_resolve_webhook_token
 *     • bella_pay_record_webhook_event
 *     • bella_pay_apply_webhook_result
 *   O client HTTP usa apenas SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY.
 *   Nenhuma tabela é aberta ao anon; a autorização de fato acontece pela
 *   posse do webhook_token na URL.
 *
 * Lógica de negócio (event-map, status-machine, value-check) permanece em
 * webhook-handler.ts / status-machine.ts / event-map.ts / value-check.ts.
 */

const PROVIDER = "asaas";

interface LogMeta {
  requestId: string;
  provider?: string;
  eventId?: string | null;
  eventType?: string;
  paymentId?: string | null;
  chargeId?: string;
  saleId?: string | null;
  companyId?: string;
  durationMs?: number;
  [k: string]: unknown;
}

function log(level: "info" | "warn" | "error", message: string, meta: LogMeta): void {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      scope: "bella-pay-webhook",
      level,
      message,
      ...meta,
    }),
  );
}

/** Cliente Supabase servidor com publishable key. Sem service role. */
function createPublicClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      `Missing Supabase env var(s): ${[!url && "SUPABASE_URL", !key && "SUPABASE_PUBLISHABLE_KEY"]
        .filter(Boolean)
        .join(", ")}`,
    );
  }
  const isNewKey = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (isNewKey && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export const Route = createFileRoute("/api/public/bella-pay/webhook/$token")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const limited = enforceRateLimit({
          route: "bella-pay:webhook",
          max: 300,
          windowMs: 60_000,
        });
        if (limited) return limited;

        const requestId = crypto.randomUUID();
        const startedAt = Date.now();
        const token = params.token;

        log("info", "Webhook iniciado", { requestId, tokenLen: token?.length ?? 0 });
        log("info", "Headers recebidos no webhook", {
          requestId,
          headerNames: Array.from(request.headers.keys()).sort(),
        });

        if (!token || token.length < 16) {
          log("warn", "Token ausente ou muito curto", { requestId });
          return new Response("Invalid token", { status: 401 });
        }

        // A Secret é lida por requisição, quando o runtime já injetou o env.
        // A busca do header é case-insensitive e usa o nome canônico do Asaas.
        const accessTokenValidation = validateAsaasWebhookAccessToken(
          request.headers,
          process.env.ASAAS_WEBHOOK_ACCESS_TOKEN,
        );
        log(accessTokenValidation.allowed ? "info" : "warn", "Validação do asaas-access-token", {
          requestId,
          secretLength: accessTokenValidation.secretLength,
          headerLength: accessTokenValidation.headerLength,
          equalsAfterTrim: accessTokenValidation.equalsAfterTrim,
        });

        if (accessTokenValidation.result === "secret_not_configured") {
          log("error", "CRÍTICO: ASAAS_WEBHOOK_ACCESS_TOKEN ausente — fail-closed", {
            requestId,
            allowed: false,
          });
          return new Response("Webhook authentication not configured", {
            status: 503,
          });
        }

        if (!accessTokenValidation.allowed) {
          return new Response("Invalid access token", { status: 401 });
        }

        let supabase: ReturnType<typeof createPublicClient>;
        try {
          supabase = createPublicClient();
        } catch (err) {
          log("error", "Falha ao criar cliente Supabase", {
            requestId,
            error: err instanceof Error ? err.message : String(err),
          });
          return new Response("Server misconfigured", { status: 500 });
        }

        // RPC 1: resolve token → company.
        const { data: resolveData, error: resolveErr } = await supabase.rpc(
          "bella_pay_resolve_webhook_token",
          { _token: token },
        );
        if (resolveErr) {
          log("error", "Erro ao resolver token", {
            requestId,
            error: resolveErr.message,
          });
          return new Response("DB error", { status: 500 });
        }
        const resolved = Array.isArray(resolveData) ? resolveData[0] : resolveData;
        if (!resolved?.company_id) {
          log("warn", "Token desconhecido", { requestId });
          return new Response("Unknown token", { status: 401 });
        }
        const companyId = resolved.company_id as string;

        // Parse body.
        let payload: AsaasWebhookPayload;
        try {
          payload = (await request.json()) as AsaasWebhookPayload;
        } catch {
          log("warn", "Payload inválido (JSON parse falhou)", { requestId });
          return new Response("Invalid JSON", { status: 400 });
        }

        const event = (payload.event ?? "") as AsaasEvent | "";
        const eventId = payload.id ?? null;
        const paymentId = payload.payment?.id ?? null;

        const baseMeta: LogMeta = {
          requestId,
          provider: PROVIDER,
          eventId,
          eventType: event || "UNKNOWN",
          paymentId,
          companyId,
          // Logs enriquecidos para diagnosticar sync de cartão vs. PIX:
          // billingType permite ver se é CREDIT_CARD / PIX / BOLETO e status
          // bruto do Asaas mostra por que uma cobrança de cartão pode chegar
          // como PAYMENT_CONFIRMED (autorizada) e nunca receber PAYMENT_RECEIVED
          // dentro do ciclo de teste do Sandbox.
          billingType: payload.payment?.billingType ?? null,
          asaasPaymentStatus: payload.payment?.status ?? null,
          paymentValue: payload.payment?.value ?? null,
          externalReference: payload.payment?.externalReference ?? null,
          // Presente quando o pagamento foi originado por um Payment Link do
          // Asaas (feature `/paymentLinks`). Vital para diagnosticar por que
          // uma cobrança via Link ficou "Aguardando confirmação".
          paymentLink:
            (payload.payment as { paymentLink?: string | null } | undefined)?.paymentLink ?? null,
          installment: payload.payment?.installment ?? null,
          installmentNumber: payload.payment?.installmentNumber ?? null,
        };
        log("info", "Evento recebido", baseMeta);

        // RPC 2: registrar evento (idempotência) + trazer charge se existir.
        const { data: recordData, error: recordErr } = await supabase.rpc(
          "bella_pay_record_webhook_event",
          {
            _company_id: companyId,
            _asaas_event_id: eventId,
            _event_type: event || "UNKNOWN",
            _payment_id: paymentId,
            _request_id: requestId,
            _payload: payload,
          } as never,
        );

        if (recordErr) {
          log("error", "Falha ao registrar evento", {
            ...baseMeta,
            error: recordErr.message,
          });
          return new Response("DB error", { status: 500 });
        }

        const recorded = (recordData ?? {}) as {
          duplicate?: boolean;
          event_id?: string | null;
          charge?: ChargeRow | null;
        };
        if (recorded.duplicate) {
          log("info", "Evento duplicado — ignorado (idempotency)", {
            ...baseMeta,
            durationMs: Date.now() - startedAt,
          });
          return Response.json({ ok: true, duplicate: true });
        }

        const dbEventId = recorded.event_id ?? null;
        const charge = recorded.charge ?? null;

        // Log da associação charge/sale — permite diagnosticar Payment Link
        // que não localiza a venda (ex.: externalReference divergente ou
        // charge não persistida antes do webhook chegar).
        log("info", "Charge localizada para o evento", {
          ...baseMeta,
          chargeId: charge?.id ?? undefined,
          saleId: charge?.sale_id ?? null,
          chargeStatus: charge?.status ?? null,
          chargeValue: charge?.value ?? null,
        });

        // Decisão pura (event-map + status-machine + value-check).
        const { result, intent } = decideWebhookEvent(
          event,
          payload,
          charge,
          (level, message, meta) => log(level, message, { ...baseMeta, ...meta }),
          baseMeta,
        );

        // RPC 3: aplicar intent + finalizar evento (atômico).
        const finalize = {
          charge_status: result.chargeStatus ?? null,
          transition_rejected: result.transitionRejected ?? false,
          value_mismatch: result.valueMismatch ?? false,
          warnings: result.warnings ?? null,
          error: null as string | null,
        };

        try {
          const { data: applyData, error: applyErr } = await supabase.rpc(
            "bella_pay_apply_webhook_result",
            {
              _event_id: dbEventId,
              _intent: intent ?? {},
              _finalize: finalize,
            } as never,
          );

          if (applyErr) throw new Error(applyErr.message);

          const applied = (applyData ?? {}) as {
            salePromoted?: boolean;
            financialTransactionId?: string | null;
          };

          const finalResult = {
            ...result,
            salePromoted: applied.salePromoted ?? result.salePromoted ?? false,
            financialTransactionId:
              applied.financialTransactionId ?? result.financialTransactionId ?? null,
          };

          log("info", "Evento processado com sucesso", {
            ...baseMeta,
            durationMs: Date.now() - startedAt,
            chargeId: charge?.id,
            chargeStatus: finalResult.chargeStatus,
            note: finalResult.note,
            transitionRejected: finalResult.transitionRejected,
            valueMismatch: finalResult.valueMismatch,
          });

          return Response.json({ ok: true, event, ...finalResult });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          // Best-effort: registrar erro no evento (RPC 3 novamente, só finalize).
          if (dbEventId) {
            await supabase.rpc("bella_pay_apply_webhook_result", {
              _event_id: dbEventId,
              _intent: {},
              _finalize: { ...finalize, error: errorMessage.slice(0, 1000) },
            } as never);
          }

          log("error", "Falha no processamento do evento", {
            ...baseMeta,
            durationMs: Date.now() - startedAt,
            error: errorMessage,
          });
          return new Response(JSON.stringify({ ok: false, error: "processing_failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
