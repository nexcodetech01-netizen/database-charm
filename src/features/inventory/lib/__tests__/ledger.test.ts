import { describe, expect, it } from "vitest";
import {
  buildCostSnapshot,
  canCreateOpeningMovement,
  computeCogs,
  computeGrossProfit,
  computeLedgerBalance,
  computeLedgerDifference,
  findItemsWithoutCost,
  isCostSnapshotComplete,
  isLedgerInconsistent,
  MISSING_COST_MESSAGE,
} from "../ledger";

describe("razão de estoque", () => {
  it("calcula saldo inicial + entradas - saídas", () => {
    const b = computeLedgerBalance([
      { type: "opening", quantity: 10 },
      { type: "in", quantity: 5 },
      { type: "out", quantity: 3 },
      { type: "adjustment", quantity: -2 },
      { type: "adjustment", quantity: 4 },
      { type: "reservation", quantity: 99 },
    ]);
    expect(b.opening).toBe(10);
    expect(b.inbound).toBe(9);
    expect(b.outbound).toBe(5);
    expect(b.ledgerStock).toBe(14);
  });

  it("detecta inconsistência entre razão e cadastro", () => {
    const b = computeLedgerBalance([{ type: "in", quantity: 5 }]);
    expect(computeLedgerDifference(12, b)).toBe(7);
    expect(isLedgerInconsistent(12, b)).toBe(true);
    expect(isLedgerInconsistent(5, b)).toBe(false);
  });

  it("reconcilia com um único movimento de abertura igual à diferença", () => {
    const b = computeLedgerBalance([{ type: "in", quantity: 5 }]);
    const diff = computeLedgerDifference(12, b);
    const after = computeLedgerBalance([
      { type: "opening", quantity: diff },
      { type: "in", quantity: 5 },
    ]);
    expect(after.ledgerStock).toBe(12);
    expect(isLedgerInconsistent(12, after)).toBe(false);
  });

  it("nunca cria abertura duplicada", () => {
    expect(canCreateOpeningMovement({ has_opening: false, difference: 7 })).toBe(true);
    expect(canCreateOpeningMovement({ has_opening: true, difference: 7 })).toBe(false);
    expect(canCreateOpeningMovement({ has_opening: false, difference: 0 })).toBe(false);
  });
});

describe("snapshot de custo", () => {
  it("grava custo médio, último custo, método e total", () => {
    const s = buildCostSnapshot({ quantity: 3, averageCost: 10, lastPurchaseCost: 12 });
    expect(s).toMatchObject({
      unit_cost: 10,
      average_cost: 10,
      last_purchase_cost: 12,
      cost_method: "average",
      total_cost: 30,
    });
    expect(isCostSnapshotComplete(s)).toBe(true);
  });

  it("respeita o método último custo de compra", () => {
    const s = buildCostSnapshot({
      quantity: 2,
      averageCost: 10,
      lastPurchaseCost: 12,
      costMethod: "last_purchase",
    });
    expect(s.unit_cost).toBe(12);
    expect(s.total_cost).toBe(24);
  });

  it("é imutável: snapshot antigo não muda quando o custo do produto muda", () => {
    const snapshot = buildCostSnapshot({ quantity: 2, averageCost: 10 });
    const novo = buildCostSnapshot({ quantity: 2, averageCost: 30 });
    expect(snapshot.unit_cost).toBe(10);
    expect(novo.unit_cost).toBe(30);
  });

  it("marca snapshot incompleto quando não há custo", () => {
    const s = buildCostSnapshot({ quantity: 2 });
    expect(isCostSnapshotComplete(s)).toBe(false);
  });
});

describe("política de custo", () => {
  const items = [
    { product_id: "p1", unit_cost: 10 },
    { product_id: "p2", unit_cost: null },
    { product_id: null, unit_cost: null },
  ];

  it("permite venda sem custo quando configurado", () => {
    expect(findItemsWithoutCost(items, true)).toHaveLength(0);
  });

  it("bloqueia itens de produto sem custo quando exigido", () => {
    const blocked = findItemsWithoutCost(items, false);
    expect(blocked).toHaveLength(1);
    expect(blocked[0].product_id).toBe("p2");
    expect(MISSING_COST_MESSAGE).toContain("Defina um custo antes da venda");
  });
});

describe("CMV e lucro bruto", () => {
  const items = [
    { quantity: 2, total: 100, unit_cost: 30, total_cost: 60 },
    { quantity: 1, total: 50, unit_cost: 20, total_cost: null },
  ];

  it("calcula CMV pelo snapshot", () => {
    expect(computeCogs(items)).toBe(80);
  });

  it("calcula lucro bruto", () => {
    expect(computeGrossProfit(items)).toEqual({ revenue: 150, cogs: 80, grossProfit: 70 });
  });
});
