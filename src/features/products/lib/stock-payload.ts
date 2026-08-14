/**
 * Decide se o campo `stock` deve ser removido do payload antes de salvar
 * uma edição de produto.
 *
 * Produtos simples: SIM, remove — o banco tem um gatilho que bloqueia
 * alteração direta de estoque (só é permitida via inventory_movements,
 * pra manter o histórico real). Produtos novos (isEdit=false) também não
 * removem, pois ainda não existe linha no banco para o gatilho reagir.
 *
 * Kits: NUNCA remove — o estoque de um kit não é físico, é sempre
 * calculado (gargalo dos componentes, com reserva opcional) e precisa
 * ser gravado diretamente ao salvar. O gatilho do banco já sabe dessa
 * exceção (ver migration 20260814233326_allow_kit_direct_stock_edit.sql).
 *
 * Bug real (2026-08-14): antes, esta condição não existia — o campo era
 * sempre removido em qualquer edição, inclusive de kits. Isso fazia a
 * reserva de estoque do kit (definida na tela) nunca ser persistida no
 * banco: a pré-visualização na tela mudava corretamente, mas o valor
 * salvo continuava o antigo, mesmo depois de recarregar a página.
 */
export function shouldStripStockFromPayload(isEdit: boolean, productType: string): boolean {
  return isEdit && productType !== "kit";
}
