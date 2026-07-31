/**
 * Traduz o par (payment_method, installments) da tabela `sales` para a
 * `method_key` correspondente em `payment_method_fees`.
 *
 * Regras:
 * - PIX, dinheiro e débito têm chaves diretas.
 * - Crédito é sempre resolvido por parcelas (1 = à vista, 2 = 2x, 3 = 3x).
 *   Quando não houver parcelas registradas, assume 1x.
 * - Métodos não mapeados retornam null (fallback = sem taxa).
 */
export function resolveFeeMethodKey(
  paymentMethod: string | null | undefined,
  installments: number | null | undefined,
): string | null {
  if (!paymentMethod) return null;
  const pm = paymentMethod.toLowerCase();
  if (pm === "pix") return "pix";
  if (pm === "cash" || pm === "dinheiro") return "cash";
  if (pm === "debit_card" || pm === "debit" || pm === "debito") return "debit_card";
  if (
    pm === "credit_card" ||
    pm === "credit" ||
    pm === "credito" ||
    pm === "card"
  ) {
    const n = Number(installments);
    const inst = Number.isFinite(n) && n >= 1 ? Math.min(3, Math.max(1, Math.trunc(n))) : 1;
    return `credit_card_${inst}`;
  }
  return null;
}
