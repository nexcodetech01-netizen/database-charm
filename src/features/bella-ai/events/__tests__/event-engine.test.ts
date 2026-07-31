import { describe, expect, it } from "vitest";
import {
  BellaEventEngine,
  BellaEventRegistry,
  BellaRecommendationEngine,
  EventPriority,
  averageTicketDropDetector,
  birthdayDetector,
  cashflowNegativeDetector,
  comparePriority,
  criticalStockDetector,
  delinquentDetector,
  deriveEventKey,
  expenseElevatedDetector,
  generateInsights,
  outOfStockDetector,
  overdueInvoiceDetector,
  priorityFromSeverity,
  revenueAboveAverageDetector,
  revenueBelowAverageDetector,
  salesDeclineDetector,
  salesGoalReachedDetector,
  slowMovingDetector,
  vipInactiveDetector,
} from "../index";

const TENANT = "tenant-1";
const NOW = new Date("2026-07-20T12:00:00Z");

function makeStack() {
  const engine = new BellaEventEngine();
  const registry = new BellaEventRegistry(engine, 0);
  registry.start();
  return { engine, registry };
}

describe("EventPriority", () => {
  it("orders CRITICAL > HIGH > MEDIUM > LOW", () => {
    const sorted = ["LOW", "CRITICAL", "MEDIUM", "HIGH"].sort((a, b) =>
      comparePriority(a as EventPriority, b as EventPriority),
    );
    expect(sorted).toEqual(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
  });

  it("maps severity to priority deterministically", () => {
    expect(priorityFromSeverity("critical")).toBe("CRITICAL");
    expect(priorityFromSeverity("warning")).toBe("HIGH");
    expect(priorityFromSeverity("success")).toBe("MEDIUM");
    expect(priorityFromSeverity("info")).toBe("LOW");
  });
});

describe("BellaEventEngine", () => {
  it("normalizes events from catalog and requires tenantId", () => {
    const engine = new BellaEventEngine();
    const evt = engine.emit({
      type: "inventory.out_of_stock",
      tenantId: TENANT,
      payload: { entityId: "p-1" },
    });
    expect(evt.module).toBe("inventory");
    expect(evt.severity).toBe("critical");
    expect(evt.priority).toBe(EventPriority.CRITICAL);
    expect(evt.recommendation).toContain("pedido");
    expect(() =>
      engine.emit({ type: "inventory.out_of_stock", tenantId: "", payload: {} }),
    ).toThrow(/tenantId/);
  });
});

describe("BellaEventRegistry", () => {
  it("dedups by stable key on upsert", () => {
    const { engine, registry } = makeStack();
    engine.emit({ type: "inventory.out_of_stock", tenantId: TENANT, payload: { entityId: "p-1" } });
    engine.emit({ type: "inventory.out_of_stock", tenantId: TENANT, payload: { entityId: "p-1" } });
    const active = registry.listActive({ tenantId: TENANT });
    expect(active).toHaveLength(1);
    expect(active[0].updatedAt).toBeInstanceOf(Date);
    const log = registry.getLog().map((l) => l.action);
    expect(log).toEqual(["created", "updated"]);
  });

  it("resolves events by payload key", () => {
    const { engine, registry } = makeStack();
    engine.emit({ type: "inventory.out_of_stock", tenantId: TENANT, payload: { entityId: "p-1" } });
    const resolved = registry.resolveByPayload({
      tenantId: TENANT,
      type: "inventory.out_of_stock",
      payload: { entityId: "p-1" },
    });
    expect(resolved?.resolvedAt).toBeInstanceOf(Date);
    expect(registry.listActive({ tenantId: TENANT })).toHaveLength(0);
    expect(registry.getLog().at(-1)?.action).toBe("resolved");
  });

  it("expires events past expiresAt", () => {
    const { engine, registry } = makeStack();
    engine.emit({
      type: "customers.birthday",
      tenantId: TENANT,
      payload: { entityId: "c-1" },
      expiresAt: new Date(NOW.getTime() - 1000),
    });
    expect(registry.sweepExpired(NOW)).toBe(1);
    expect(registry.listActive({ tenantId: TENANT })).toHaveLength(0);
    expect(registry.getLog().at(-1)?.action).toBe("expired");
  });

  it("returns top priorities sorted by priority then severity", () => {
    const { engine, registry } = makeStack();
    engine.emit({ type: "customers.birthday", tenantId: TENANT, payload: { entityId: "c-1" } });
    engine.emit({ type: "inventory.min_stock_reached", tenantId: TENANT, payload: { entityId: "p-1" } });
    engine.emit({ type: "finance.cashflow.negative", tenantId: TENANT, payload: {} });
    engine.emit({ type: "sales.goal_reached", tenantId: TENANT, payload: {} });
    engine.emit({ type: "inventory.out_of_stock", tenantId: TENANT, payload: { entityId: "p-2" } });

    const top = registry.getTopPriorities(TENANT, 4);
    expect(top).toHaveLength(4);
    expect(top[0].priority).toBe(EventPriority.CRITICAL);
    // Birthday (LOW) deve ficar fora
    expect(top.some((e) => e.type === "customers.birthday")).toBe(false);
  });
});

describe("BellaRecommendationEngine", () => {
  it("produces one recommendation per known event", () => {
    const engine = new BellaEventEngine();
    const rec = new BellaRecommendationEngine(engine);
    rec.start();
    engine.emit({ type: "inventory.out_of_stock", tenantId: TENANT, payload: { entityId: "p-1" } });
    engine.emit({ type: "customers.vip.inactive", tenantId: TENANT, payload: { entityId: "c-9" } });
    const list = rec.list();
    expect(list).toHaveLength(2);
    expect(list.every((r) => r.actionLabel.length > 0)).toBe(true);
    expect(list[0].priority).toBeDefined();
  });
});

describe("Detectors", () => {
  const ctx = { tenantId: TENANT, now: NOW };

  it("finance: cashflow negative + resolve when positive", () => {
    expect(cashflowNegativeDetector.detect({ balance: -50 }, ctx).emit).toHaveLength(1);
    const positive = cashflowNegativeDetector.detect({ balance: 100 }, ctx);
    expect(positive.emit).toHaveLength(0);
    expect(positive.resolve[0]).toBe(
      deriveEventKey({ tenantId: TENANT, type: "finance.cashflow.negative", payload: {} }),
    );
  });

  it("finance: overdue invoices emits per invoice", () => {
    const out = overdueInvoiceDetector.detect(
      [
        { invoiceId: "i-1", amount: 100, dueDate: NOW },
        { invoiceId: "i-2", amount: 200, dueDate: NOW },
      ],
      ctx,
    );
    expect(out.emit).toHaveLength(2);
  });

  it("finance: revenue bands honor threshold", () => {
    const above = revenueAboveAverageDetector.detect(
      { currentRevenue: 1500, averageRevenue: 1000 },
      ctx,
    );
    expect(above.emit).toHaveLength(1);
    const below = revenueBelowAverageDetector.detect(
      { currentRevenue: 700, averageRevenue: 1000 },
      ctx,
    );
    expect(below.emit).toHaveLength(1);
    const stable = revenueAboveAverageDetector.detect(
      { currentRevenue: 1050, averageRevenue: 1000 },
      ctx,
    );
    expect(stable.emit).toHaveLength(0);
  });

  it("finance: elevated expenses", () => {
    expect(
      expenseElevatedDetector.detect({ currentExpense: 2000, averageExpense: 1000 }, ctx).emit,
    ).toHaveLength(1);
    expect(
      expenseElevatedDetector.detect({ currentExpense: 900, averageExpense: 1000 }, ctx).emit,
    ).toHaveLength(0);
  });

  it("inventory: critical, out of stock, slow moving", () => {
    const snapshot = [
      { productId: "p-1", name: "A", stock: 0, minStock: 5, daysWithoutSale: 30 },
      { productId: "p-2", name: "B", stock: 3, minStock: 5, daysWithoutSale: 10 },
      { productId: "p-3", name: "C", stock: 20, minStock: 5, daysWithoutSale: 90 },
    ];
    expect(criticalStockDetector.detect(snapshot, ctx).emit).toHaveLength(1);
    expect(outOfStockDetector.detect(snapshot, ctx).emit).toHaveLength(1);
    const slow = slowMovingDetector.detect({ products: snapshot }, ctx);
    expect(slow.emit).toHaveLength(1);
    expect(slow.emit[0].payload).toMatchObject({ entityId: "p-3" });
  });

  it("customers: vip inactive / delinquent / birthday", () => {
    const bday = new Date(NOW);
    const customers = [
      { customerId: "c-1", name: "Vip", isVip: true, daysSinceLastPurchase: 60 },
      { customerId: "c-2", name: "Del", hasOverdueInvoices: true },
      { customerId: "c-3", name: "Aniv", birthday: bday },
    ];
    expect(vipInactiveDetector.detect({ customers }, ctx).emit).toHaveLength(1);
    expect(delinquentDetector.detect(customers, ctx).emit).toHaveLength(1);
    const b = birthdayDetector.detect(customers, ctx);
    expect(b.emit).toHaveLength(1);
    expect(b.emit[0].expiresAt).toBeInstanceOf(Date);
  });

  it("sales: goal / decline / ticket drop", () => {
    expect(
      salesGoalReachedDetector.detect({ currentTotal: 1200, goal: 1000 }, ctx).emit,
    ).toHaveLength(1);
    expect(
      salesDeclineDetector.detect(
        { currentPeriodTotal: 500, previousPeriodTotal: 1000 },
        ctx,
      ).emit,
    ).toHaveLength(1);
    expect(
      averageTicketDropDetector.detect(
        { currentAverageTicket: 60, previousAverageTicket: 100 },
        ctx,
      ).emit,
    ).toHaveLength(1);
  });
});

describe("Insights", () => {
  it("aggregates active events into human-readable phrases", () => {
    const { engine, registry } = makeStack();
    engine.emit({ type: "inventory.out_of_stock", tenantId: TENANT, payload: { entityId: "p-1" } });
    engine.emit({ type: "inventory.out_of_stock", tenantId: TENANT, payload: { entityId: "p-2" } });
    engine.emit({ type: "finance.cashflow.negative", tenantId: TENANT, payload: {} });
    const insights = generateInsights(registry.listActive({ tenantId: TENANT }));
    expect(insights.length).toBeGreaterThanOrEqual(2);
    expect(insights.some((i) => i.message.includes("2 produto"))).toBe(true);
    expect(insights.some((i) => i.module === "finance")).toBe(true);
  });
});
