/**
 * PDV — Validação de estoque unificada.
 *
 * Este módulo é a fonte única de verdade para "este item da venda pode ser
 * comercializado com base no estoque disponível?". Usado por:
 *
 * - `sale-form.tsx` no clique de "Continuar" (revalida ao abrir o Checkout).
 * - `createAsaasCharge` no servidor (barra bypass de UI antes de tocar Asaas).
 * - Testes unitários (`stock-validation.test.ts`).
 *
 * Regras:
 * - `stock_available == null` significa "não rastreado" (serviço, kit dinâmico,
 *   produto sem controle) → nunca bloqueia.
 * - Quantidade acima do disponível bloqueia.
 * - Itens sem `product_id` (venda avulsa/descrição livre) não são validados
 *   contra estoque — não há produto para consultar.
 */

export interface StockCandidate {
  product_id?: string | null;
  description?: string | null;
  quantity: number;
  stock_available?: number | null;
}

export interface StockInsufficiency<T extends StockCandidate = StockCandidate> {
  item: T;
  requested: number;
  available: number;
  /** Diferença positiva entre pedido e disponível. */
  shortage: number;
}

/**
 * Retorna a lista de itens com estoque insuficiente considerando um mapa
 * "fresco" opcional vindo do banco (usado para revalidação concorrente).
 *
 * Quando `freshStock` contém o `product_id`, esse valor tem precedência sobre
 * `stock_available` do próprio item — é a garantia contra consumo concorrente
 * de outro operador durante a montagem da venda.
 */
export function computeStockInsufficiencies<T extends StockCandidate>(
  items: readonly T[],
  freshStock?: ReadonlyMap<string, number | null>,
): StockInsufficiency<T>[] {
  const out: StockInsufficiency<T>[] = [];
  for (const item of items) {
    const pid = item.product_id ?? null;
    const fresh =
      pid && freshStock?.has(pid) ? freshStock.get(pid) ?? null : undefined;
    const available =
      fresh !== undefined ? fresh : item.stock_available ?? null;
    if (available == null) continue; // não rastreado
    if (item.quantity <= available) continue;
    out.push({
      item,
      requested: item.quantity,
      available,
      shortage: Number((item.quantity - available).toFixed(4)),
    });
  }
  return out;
}

/**
 * Mensagem humana pt-BR resumindo as insuficiências (até `limit` itens).
 */
export function formatInsufficiencyMessage<T extends StockCandidate>(
  insufficiencies: readonly StockInsufficiency<T>[],
  limit = 3,
): string {
  if (insufficiencies.length === 0) return "";
  const lines = insufficiencies
    .slice(0, limit)
    .map(
      ({ item, requested, available }) =>
        `${item.description ?? "Item"} (pedido ${requested}, disponível ${available})`,
    )
    .join("; ");
  const extra =
    insufficiencies.length > limit
      ? ` e mais ${insufficiencies.length - limit}`
      : "";
  return `${lines}${extra}`;
}
