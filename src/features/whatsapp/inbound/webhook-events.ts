/**
 * Extração de TODOS os eventos de um POST do webhook do WhatsApp (Meta).
 *
 * A Meta agrupa vários eventos num único POST: vários `entry`, cada um com
 * vários `changes`, cada `value` com várias `messages` e/ou `statuses`.
 * Antes (auditoria 4.3), o webhook lia só `entry[0].changes[0].messages[0]`
 * — sob carga, as demais mensagens de clientes eram descartadas sem rastro,
 * e um `status` que viesse junto com uma mensagem também era ignorado.
 *
 * Módulo puro (sem banco): fácil de testar.
 */

export interface NormalizedWhatsAppMessage {
  waMessageId: string;
  waContactId: string;
  phone: string;
  text: string;
  timestamp: number;
  profileName: string;
  type: string;
  raw: unknown;
}

export interface WhatsAppInboundEvent {
  /** `metadata.phone_number_id` — identifica a empresa dona do número. */
  phoneNumberId: string | null;
  msg: NormalizedWhatsAppMessage | null;
  status: Record<string, unknown> | null;
}

type AnyRecord = Record<string, unknown>;

const asArray = (v: unknown): AnyRecord[] =>
  Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as AnyRecord[]) : [];

function normalizeMessage(msg: AnyRecord, contacts: AnyRecord[]): NormalizedWhatsAppMessage | null {
  const id = typeof msg.id === "string" ? msg.id : null;
  const from = typeof msg.from === "string" ? msg.from : null;
  if (!id || !from) return null;

  const contact = contacts.find((c) => c.wa_id === from) ?? contacts[0];
  const profile = (contact?.profile ?? {}) as AnyRecord;
  const text = ((msg.text ?? {}) as AnyRecord).body;
  const ts = Number.parseInt(String(msg.timestamp ?? ""), 10);

  return {
    waMessageId: id,
    waContactId: from,
    phone: from,
    text: typeof text === "string" ? text : "",
    timestamp: Number.isFinite(ts) ? ts * 1000 : Date.now(),
    profileName: typeof profile.name === "string" && profile.name ? profile.name : "Cliente",
    type: typeof msg.type === "string" ? msg.type : "unknown",
    raw: msg,
  };
}

export function extractWhatsAppEvents(payload: unknown): WhatsAppInboundEvent[] {
  const events: WhatsAppInboundEvent[] = [];
  if (!payload || typeof payload !== "object") return events;

  for (const entry of asArray((payload as AnyRecord).entry)) {
    for (const change of asArray(entry.changes)) {
      const value = (change.value ?? null) as AnyRecord | null;
      if (!value || typeof value !== "object") continue;

      const metadata = (value.metadata ?? {}) as AnyRecord;
      const phoneNumberId =
        typeof metadata.phone_number_id === "string" ? metadata.phone_number_id : null;
      const contacts = asArray(value.contacts);

      for (const raw of asArray(value.messages)) {
        const msg = normalizeMessage(raw, contacts);
        if (msg) events.push({ phoneNumberId, msg, status: null });
      }
      for (const status of asArray(value.statuses)) {
        events.push({ phoneNumberId, msg: null, status });
      }
    }
  }
  return events;
}

/** Identificador estável do evento (para logs e DLQ). */
export function whatsAppEventReference(event: WhatsAppInboundEvent): string | null {
  if (event.msg) return event.msg.waMessageId;
  const id = event.status?.id;
  const st = event.status?.status;
  return typeof id === "string" ? `${id}${typeof st === "string" ? `:${st}` : ""}` : null;
}
