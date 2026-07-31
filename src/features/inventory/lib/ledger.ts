/**
 * Razão de estoque — funções puras (Sprint P0).
 *
 * Regra matemática única do NexOS:
 *   saldo_inicial + entradas - saídas = saldo_atual
 *
 * Estas funções espelham exatamente `public.inventory_ledger_audit` para que
 * UI, testes e banco nunca divirjam.
 */

export type LedgerMovement = {
  type: string;
  quantity: number;
};

export type LedgerBalance = {
  opening: number;
  inbound: number;
  outbound: number;
  ledgerStock: number;
};

export type LedgerAuditRow = {
  product_id: string;
  sku: string | null;
  name: string;
  opening: number;
  inbound: number;
  outbound: number;
  ledger_stock: number;
  current_stock: number;
  difference: number;
  inconsistent: boolean;
  has_opening: boolean;
  unit_cost: number | null;
};

export function computeLedgerBalance(movements: LedgerMovement[]): LedgerBalance {
  let opening = 0;
  let inbound = 0;
  let outbound = 0;

  for (const m of movements) {
    const qty = Number(m.quantity ?? 0);
    if (m.type === "opening") opening += qty;
    else if (m.type === "in") inbound += Math.abs(qty);
    else if (m.type === "out") outbound += Math.abs(qty);
    else if (m.type === "adjustment") {
      if (qty >= 0) inbound += qty;
      else outbound += Math.abs(qty);
    }
  }

  return { opening, inbound, outbound, ledgerStock: opening + inbound - outbound };
}

export function computeLedgerDifference(currentStock: number, balance: LedgerBalance) {
  return Number((Number(currentStock ?? 0) - balance.ledgerStock).toFixed(6));
}

export function isLedgerInconsistent(currentStock: number, balance: LedgerBalance) {
  return computeLedgerDifference(currentStock, balance) !== 0;
}

/** Um produto só pode receber um movimento de abertura. */
export function canCreateOpeningMovement(row: Pick<LedgerAuditRow, "has_opening" | "difference">) {
  return !row.has_opening && Number(row.difference ?? 0) !== 0;
}

// ============================================================
// Snapshot de custo
// ============================================================
export type CostMethod = "average" | "last_purchase";

export type CostSnapshot = {
  unit_cost: number | null;
  average_cost: number | null;
  last_purchase_cost: number | null;
  cost_method: CostMethod;
  total_cost: number | null;
};

export function buildCostSnapshot(input: {
  quantity: number;
  averageCost?: number | null;
  lastPurchaseCost?: number | null;
  unitCost?: number | null;
  costMethod?: CostMethod;
}): CostSnapshot {
  const method: CostMethod = input.costMethod ?? "average";
  const average = numOrNull(input.averageCost);
  const last = numOrNull(input.lastPurchaseCost);
  const preferred = method === "last_purchase" ? (last ?? average) : (average ?? last);
  const unit = numOrNull(input.unitCost) ?? preferred;

  return {
    unit_cost: unit,
    average_cost: average,
    last_purchase_cost: last,
    cost_method: method,
    total_cost: unit == null ? null : round6(unit * Number(input.quantity ?? 0)),
  };
}

export function isCostSnapshotComplete(snapshot: CostSnapshot) {
  return snapshot.unit_cost != null && snapshot.total_cost != null && !!snapshot.cost_method;
}

export const MISSING_COST_MESSAGE =
  "O produto não possui custo registrado. Defina um custo antes da venda.";

/**
 * Política de custo: quando a empresa não permite venda sem custo, itens com
 * produto e sem custo bloqueiam a finalização.
 */
export function findItemsWithoutCost<T extends { product_id?: string | null; unit_cost?: number | null }>(
  items: T[],
  allowSaleWithoutCost: boolean,
): T[] {
  if (allowSaleWithoutCost) return [];
  return items.filter(
    (it) => !!it.product_id && (it.unit_cost == null || Number(it.unit_cost) <= 0),
  );
}

// ============================================================
// CMV e lucro bruto (a partir do snapshot imutável)
// ============================================================
export function computeCogs(items: { quantity: number; unit_cost?: number | null; total_cost?: number | null }[]) {
  return round6(
    items.reduce((acc, it) => {
      const total = it.total_cost != null ? Number(it.total_cost) : (it.unit_cost ?? 0) * (it.quantity ?? 0);
      return acc + Number(total || 0);
    }, 0),
  );
}

export function computeGrossProfit(
  items: { quantity: number; total?: number | null; unit_cost?: number | null; total_cost?: number | null }[],
) {
  const revenue = round6(items.reduce((acc, it) => acc + Number(it.total ?? 0), 0));
  const cogs = computeCogs(items);
  return { revenue, cogs, grossProfit: round6(revenue - cogs) };
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function round6(n: number) {
  return Number(Number(n || 0).toFixed(6));
}
