/**
 * P1-04 — Padronização de transaction_date.
 * Asaas envia paymentDate em "YYYY-MM-DD" (data local do pagamento).
 * Nunca aplicamos toISOString() sobre um Date parseado sem timezone
 * porque isso deslocaria o dia em GMT-3.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Retorna sempre "YYYY-MM-DD".
 * - Se `raw` já for "YYYY-MM-DD", retorna como está.
 * - Se for ISO completo ("...T..."), extrai o prefixo (evita conversão UTC).
 * - Se for inválido/ausente, cai para `fallback` (default: hoje UTC).
 */
export function toTransactionDate(
  raw: string | null | undefined,
  fallbackIso?: string,
): string {
  if (raw && typeof raw === "string") {
    if (ISO_DATE.test(raw)) return raw;
    if (raw.length >= 10 && ISO_DATE.test(raw.slice(0, 10))) {
      return raw.slice(0, 10);
    }
  }
  const iso = fallbackIso ?? new Date().toISOString();
  return iso.slice(0, 10);
}
