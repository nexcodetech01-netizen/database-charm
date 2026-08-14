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
  /**
   * Teto opcional de quantas unidades deste componente estão reservadas
   * para este kit específico — usado quando o mesmo componente é
   * compartilhado por mais de um kit (ex.: "Capinha A15" usada tanto no
   * "Kit Comum" quanto no "Kit Privacidade"). `undefined`/`null` = usa o
   * estoque total do componente, sem reserva (comportamento padrão).
   */
  reserved_quantity?: number | null;
  [key: string]: unknown;
}

export interface FreshComponentData {
  id: string;
  stock: number;
  cost: number;
}

/**
 * Calcula o "gargalo" de estoque do kit a partir da composição — a
 * MESMA fórmula usada em `reconcileKitWithFreshData`, extraída aqui para
 * poder ser reaproveitada também na pré-visualização ao vivo (antes de
 * salvar), sem duplicar a lógica.
 *
 * Bug real (2026-08-14): existiam DUAS implementações independentes
 * desse cálculo — uma em `kit-composition-module.tsx` (que já
 * respeitava `reserved_quantity`) e outra em `product-form/index.tsx`
 * (`calculateKitStock`, que não sabia da reserva). Toda vez que a
 * composição mudava, um efeito sincronizava `form.stock` usando a
 * segunda — sobrescrevendo silenciosamente a reserva que o usuário
 * acabara de definir, revertendo pro valor "cheio" (sem reserva).
 */
export function computeKitBottleneck(
  composition: KitComponentItem[],
  unitsSoldOfThisKit = 0,
): number {
  if (!composition || composition.length === 0) return 0;
  const bottlenecks = composition.map((item) => {
    const quantity = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
    const physicalMax = Math.floor(Number(item.stock ?? 0) / quantity);
    if (item.reserved_quantity == null) return physicalMax;
    const remainingReservation = Math.max(0, Number(item.reserved_quantity) - unitsSoldOfThisKit);
    return Math.min(physicalMax, remainingReservation);
  });
  return Math.min(...bottlenecks);
}

export function reconcileKitWithFreshData(
  composition: KitComponentItem[],
  freshData: FreshComponentData[],
  /**
   * Unidades já vendidas DESTE kit (o produto-pai, não os componentes) —
   * usado para descontar da reserva de cada componente, mantendo o número
   * exibido sempre correto sem precisar de ajuste manual após cada venda.
   * Quando omitido, assume 0 (ex.: produto novo, ainda sem vendas).
   */
  unitsSoldOfThisKit = 0,
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

  const stock = computeKitBottleneck(reconciled, unitsSoldOfThisKit);
  const cost = reconciled.reduce((acc, item) => acc + item.cost * item.quantity, 0);

  return { stock, cost, composition: reconciled };
}
