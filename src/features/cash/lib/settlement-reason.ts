/**
 * Detecta se uma movimentação de caixa foi gerada automaticamente pelo
 * motor financeiro (RPCs oficiais: `settle_financial_transaction`,
 * `reverse_financial_transaction`, `complete_settlement_data`) — essas
 * são só informativas para a conferência de caixa (aparecem no
 * histórico), mas NUNCA devem contar como suprimento/sangria manual no
 * cálculo de "dinheiro esperado" do fechamento.
 *
 * Bug real (2026-08-18, achado com um relatório de fechamento real em
 * mãos): antes comparava o motivo por IGUALDADE EXATA
 * ("baixa financeira"), mas o motivo real gravado tem um sufixo depois
 * de um travessão — ex.: "Baixa financeira — Baixa automática PDV",
 * "Baixa financeira — Comissão ML". A comparação exata nunca batia
 * (nem a capitalização "Baixa" vs "baixa" batia), então essas
 * movimentações automáticas eram contadas como manuais — inflando o
 * "dinheiro esperado" do fechamento com o valor de TODA venda,
 * inclusive as pagas em Pix/cartão, que nunca deveriam afetar o
 * dinheiro físico esperado na gaveta.
 *
 * Mesma correção aplicada em paralelo na view SQL
 * `view_cash_session_summary` (migration 20260818112847) — essa aqui é
 * a versão usada para separar as listas no lado do cliente.
 */
const SETTLEMENT_REASON_PREFIXES = [
  "baixa financeira",
  "saneamento de baixa",
  "estorno de baixa financeira",
];

export function isSettlementReason(reason: string | null | undefined): boolean {
  const normalized = (reason ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return SETTLEMENT_REASON_PREFIXES.some(
    (prefix) =>
      normalized === prefix ||
      normalized.startsWith(`${prefix} —`) ||
      normalized.startsWith(`${prefix} -`),
  );
}
