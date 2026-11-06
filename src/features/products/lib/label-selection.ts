/** Seleção de produtos na lista para imprimir etiquetas pelo estoque. */
export type LabelSelection = Map<string, number>; // id → estoque

export function toggleIds(
  sel: LabelSelection,
  rows: { id: string; stock?: number | string | null }[],
  checked: boolean,
): LabelSelection {
  const next = new Map(sel);
  for (const r of rows) {
    if (checked) next.set(r.id, Number(r.stock) || 0);
    else next.delete(r.id);
  }
  return next;
}

/** Itens para a janela de etiquetas: 1 etiqueta por peça em estoque. */
export function labelsFromSelection(sel: LabelSelection) {
  const initial: { productId: string; quantity: number }[] = [];
  let withoutStock = 0;
  for (const [productId, stock] of sel) {
    const q = Math.floor(Number(stock) || 0);
    if (q > 0) initial.push({ productId, quantity: q });
    else withoutStock += 1;
  }
  const labels = initial.reduce((s, i) => s + i.quantity, 0);
  return { initial, withoutStock, labels };
}
