/**
 * Processamento server-only dos eventos do webhook do WhatsApp.
 *
 * - Processa TODOS os eventos do POST (ver webhook-events.ts), um por vez.
 * - Resolve a empresa uma vez por `phone_number_id`.
 * - Falha em um evento não derruba os demais: o evento vai para a Dead Letter
 *   Queue (`integration_dead_letters`, source "whatsapp") e é reprocessado
 *   pelo job `/api/public/jobs/dlq-reprocess`. Reprocessar é seguro: o roteador
 *   deduplica mensagens por `wa_message_id`.
 */
import type { WhatsAppInboundEvent } from "./webhook-events";
import { whatsAppEventReference } from "./webhook-events";

export const WHATSAPP_DLQ_SOURCE = "whatsapp";

export interface WhatsAppProcessDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  handle?: (input: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: any;
    msg: WhatsAppInboundEvent["msg"];
    status: WhatsAppInboundEvent["status"];
    tenant: { companyId: string };
    startedAt: number;
  }) => Promise<unknown>;
  recordDeadLetter?: (input: {
    companyId?: string | null;
    source: string;
    topic?: string | null;
    reference?: string | null;
    payload: unknown;
    errorMessage: string;
  }) => Promise<void>;
}

export interface WhatsAppProcessResult {
  total: number;
  processed: number;
  failed: number;
  unknownNumber: number;
}

async function resolveDeps(deps: WhatsAppProcessDeps) {
  const handle = deps.handle ?? (await import("./router.server")).handleWhatsAppInboundPayload;
  const recordDeadLetter =
    deps.recordDeadLetter ?? (await import("@/lib/dead-letter.server")).recordDeadLetter;
  return { handle, recordDeadLetter };
}

export async function processWhatsAppEvents(
  events: WhatsAppInboundEvent[],
  deps: WhatsAppProcessDeps,
): Promise<WhatsAppProcessResult> {
  const result: WhatsAppProcessResult = {
    total: events.length,
    processed: 0,
    failed: 0,
    unknownNumber: 0,
  };
  if (events.length === 0) return result;

  const { handle, recordDeadLetter } = await resolveDeps(deps);
  const companyByNumber = new Map<string, string | null>();

  for (const event of events) {
    const reference = whatsAppEventReference(event);
    let companyId: string | null = null;
    try {
      const key = event.phoneNumberId ?? "";
      if (!companyByNumber.has(key)) {
        const { data } = key
          ? await deps.db
              .from("companies")
              .select("id")
              .eq("whatsapp_phone_number_id", key)
              .maybeSingle()
          : { data: null };
        companyByNumber.set(key, (data as { id?: string } | null)?.id ?? null);
      }
      companyId = companyByNumber.get(key) ?? null;

      if (!companyId) {
        result.unknownNumber += 1;
        console.warn("[whatsapp.webhook] nenhuma empresa para o phone_number_id", {
          phoneNumberId: event.phoneNumberId,
        });
        continue;
      }

      await handle({
        db: deps.db,
        msg: event.msg,
        status: event.status,
        tenant: { companyId },
        startedAt: Date.now(),
      });
      result.processed += 1;
    } catch (err) {
      result.failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error("[whatsapp.webhook] falha ao processar evento — enviado à DLQ", {
        reference,
        error: message,
      });
      await recordDeadLetter({
        companyId,
        source: WHATSAPP_DLQ_SOURCE,
        topic: event.msg ? "message" : "status",
        reference,
        payload: event,
        errorMessage: message,
      });
    }
  }
  return result;
}

/**
 * Reprocessa um evento guardado na DLQ. Lança erro se falhar de novo (o job
 * de reprocessamento conta a tentativa).
 */
export async function reprocessWhatsAppDeadLetter(
  payload: unknown,
  deps: Omit<WhatsAppProcessDeps, "recordDeadLetter">,
): Promise<void> {
  const event = payload as WhatsAppInboundEvent;
  if (!event || typeof event !== "object" || (!event.msg && !event.status)) {
    throw new Error("payload de DLQ do WhatsApp inválido");
  }
  let lastError: string | null = null;
  const res = await processWhatsAppEvents([event], {
    ...deps,
    recordDeadLetter: async (input) => {
      lastError = input.errorMessage; // não cria nova entrada; o job conta a tentativa
    },
  });
  if (res.failed > 0) throw new Error(lastError ?? "falha ao reprocessar evento do WhatsApp");
  if (res.unknownNumber > 0) throw new Error("número do WhatsApp sem empresa vinculada");
}
