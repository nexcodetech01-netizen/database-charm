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
 */

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
): string | null {
  const wanted = settlementAccountType(paymentMethod);
  const posDefault = activeAccounts.find((a) => a.id === posDefaultAccountId);
  if (posDefault?.type === wanted) return posDefault.id;

  const ofType = activeAccounts.find((a) => a.type === wanted);
  if (ofType) return ofType.id;

  return posDefault?.id ?? activeAccounts[0]?.id ?? null;
}
