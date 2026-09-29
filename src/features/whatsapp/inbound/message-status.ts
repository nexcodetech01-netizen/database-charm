/**
 * Avisos de status da Meta (sent → delivered → read, ou failed) para as
 * mensagens que ENVIAMOS. Chegam no mesmo webhook das mensagens novas,
 * mas sem `messages` — só `statuses`.
 *
 * BUG CORRIGIDO (2026-09-29): o router tratava todo evento como mensagem
 * nova e quebrava ao ler `msg.waContactId` num aviso de status. O webhook
 * respondia 200 à Meta mesmo assim, então os avisos se perdiam em silêncio
 * e as conversas ficavam sem "entregue/lido".
 */

export interface MetaStatusEvent {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: Array<{ code?: number; title?: string; message?: string }>;
}

// Avisos podem chegar fora de ordem: "delivered" depois de "read" não pode
// rebaixar a mensagem. "failed" sempre vale.
const RANK: Record<string, number> = {
  received: 0,
  queued: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

export function shouldApplyStatus(current: string | null | undefined, next: string): boolean {
  if (next === "failed") return current !== "failed";
  if (!(next in RANK)) return false;
  if (current === "failed") return false;
  return (RANK[next] ?? 0) > (RANK[current ?? ""] ?? -1);
}

export function statusErrorText(event: MetaStatusEvent): string | null {
  const err = event.errors?.[0];
  if (!err) return null;
  return [err.code, err.title, err.message].filter(Boolean).join(" — ") || null;
}

/**
 * Atualiza o status da mensagem enviada com esse wa_message_id.
 * @returns o status gravado, ou null se não havia o que atualizar.
 */
export async function applyWhatsAppStatus({
  db,
  status,
  tenant,
}: {
  db: any;
  status: MetaStatusEvent;
  tenant: { companyId: string };
}): Promise<string | null> {
  const waMessageId = status?.id;
  const next = String(status?.status ?? "").toLowerCase();
  if (!waMessageId || !next) return null;

  const { data: message, error: readError } = await db
    .from("whatsapp_messages")
    .select("id, status")
    .eq("company_id", tenant.companyId)
    .eq("wa_message_id", waMessageId)
    .maybeSingle();
  if (readError) throw readError;
  if (!message) return null; // mensagem não enviada por nós (ou ainda não gravada)
  if (!shouldApplyStatus(message.status, next)) return null;

  const patch: Record<string, unknown> = { status: next };
  if (next === "failed") patch.error = statusErrorText(status);

  const { error: updateError } = await db
    .from("whatsapp_messages")
    .update(patch)
    .eq("id", message.id);
  if (updateError) throw updateError;
  return next;
}
