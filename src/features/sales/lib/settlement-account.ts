/**
 * Em qual conta financeira cai o recebimento de uma venda do PDV.
 *
 * BUG CORRIGIDO (2026-09-30): todo recebimento ia para a conta padrão do
 * PDV (o Caixa), inclusive PIX e cartão — que na vida real caem no banco.
 * Resultado: no sistema o Caixa acumulava dinheiro que nunca esteve na
 * gaveta e o Banco ficava negativo (só com saídas).
 *
  * Regra: dinheiro → conta do tipo "cash"; PIX e cartões → conta "bank".
 * A conta padrão do PDV continua valendo quando é do tipo certo. Sem conta
 * do tipo certo, cai no comportamento antigo (padrão do PDV / primeira ativa).
 *
 * Maquininha (2026-09-30): se a empresa definiu a conta da maquininha
 * (companies.card_machine_account_id, ex.: InfinitePay), débito, crédito e
 * PIX pago na maquininha ("pix") caem nela. O PIX da chave própria
 * ("pix_manual") continua indo para o banco.
 */

/** Formas de pagamento recebidas pela maquininha. */
export const CARD_MACHINE_METHODS: ReadonlySet<string> = new Set(["debit_card", "credit_card", "pix"]);

export interface SettlementAccountOption {
  id: string;
  type: string | null;
}

export function settlementAccountType(paymentMethod: string): "cash" | "bank" {
  return paymentMethod === "cash" ? "cash" : "bank";
}

export function pickSettlementAccount(
  paymentMethod: string,
  activeAccounts: readonly SettlementAccountOption[],
  posDefaultAccountId: string | null | undefined,
  cardMachineAccountId?: string | null,
): string | null {
  if (CARD_MACHINE_METHODS.has(paymentMethod) && cardMachineAccountId) {
    const machine = activeAccounts.find((a) => a.id === cardMachineAccountId);
    if (machine) return machine.id;
  }

  const wanted = settlementAccountType(paymentMethod);
  const posDefault = activeAccounts.find((a) => a.id === posDefaultAccountId);
  if (posDefault?.type === wanted) return posDefault.id;

  const ofType = activeAccounts.find((a) => a.type === wanted);
  if (ofType) return ofType.id;

  return posDefault?.id ?? activeAccounts[0]?.id ?? null;
}

/** Chave da taxa em payment_method_fees para uma venda na maquininha. */
export function machineFeeKey(paymentMethod: string, installments: number | null | undefined): string | null {
  if (paymentMethod === "debit_card") return "debit_card";
  if (paymentMethod === "pix") return "pix";
  if (paymentMethod === "credit_card") {
    const n = Math.min(3, Math.max(1, Math.trunc(Number(installments) || 1)));
    return `credit_card_${n}`;
  }
  return null;
}

/** Valor da taxa (percentual + fixa), arredondado em centavos. */
export function machineFeeAmount(
  gross: number,
  fee: { fee_percent: number | null; fee_fixed: number | null } | null | undefined,
): number {
  if (!fee) return 0;
  const value = (Number(gross) || 0) * (Number(fee.fee_percent) || 0) / 100 + (Number(fee.fee_fixed) || 0);
  return Math.max(0, Math.round(value * 100) / 100);
}
