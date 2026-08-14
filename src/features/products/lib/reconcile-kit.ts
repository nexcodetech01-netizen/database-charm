/**
 * Recalcula o estoque (gargalo) e o custo de um kit a partir de dados
 * ATUAIS dos componentes — não confia nos valores de `stock`/`cost`
 * capturados na composição em tela, que são uma "foto" tirada no
 * momento em que cada componente foi adicionado (ou no carregamento da
 * tela de edição). Se o estoque/custo real de um componente mudar
 * durante a sessão de edição do kit, essa foto fica desatualizada — o
 * que salvávamos no banco não refletia a realidade.
 *
 * Bug real (2026-08-13, retomado 2026-08-14): usado no momento de salvar
 * para garantir que o produto-kit persistido sempre reflita o estoque e
 * custo reais dos componentes naquele instante.
 */
export interface KitComponentItem {
  component_id: string;
  quantity: number;
  stock: number;
  cost: number;
  [key: string]: unknown;
}

export interface FreshComponentData {
  id: string;
  stock: number;
  cost: number;
}

export function reconcileKitWithFreshData(
  composition: KitComponentItem[],
  freshData: FreshComponentData[],
): { stock: number; cost: number; composition: KitComponentItem[] } {
  const dataById = new Map<string, { stock: number; cost: number }>(
    freshData.map((p) => [p.id, { stock: p.stock, cost: p.cost }]),
  );

  const reconciled = composition.map((item) => {
    const fresh = dataById.get(item.component_id);
    return fresh ? { ...item, stock: fresh.stock, cost: fresh.cost } : item;
  });

  if (reconciled.length === 0) {
    return { stock: 0, cost: 0, composition: reconciled };
  }

  const bottlenecks = reconciled.map((item) =>
    item.quantity > 0 ? Math.floor(item.stock / item.quantity) : 0,
  );
  const stock = Math.min(...bottlenecks);
  const cost = reconciled.reduce((acc, item) => acc + item.cost * item.quantity, 0);

  return { stock, cost, composition: reconciled };
}
