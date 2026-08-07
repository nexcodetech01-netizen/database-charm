import { describe, it, expect } from "vitest";
import { auditInventoryClosing } from "../queries/inventory-audit";
import { AccountingSummary } from "../../types";

describe("auditInventoryClosing", () => {
  const mockSummary: AccountingSummary = {
    companyId: "test",
    period: { start: "2024-01-01", end: "2024-01-31" },
    generatedAt: new Date().toISOString(),
    inventory: {
      data: {
        inventoryValue: 10000,
        stagnantCount: 5,
        belowMinCount: 10,
        productCount: 100,
        totalItems: 500
      }
    }
  } as any;

  it("should detect negative stock", () => {
    const products: any[] = [
      { id: "1", name: "Negativo", stock: -5, sku: "NEG-1", minStock: 2, cost: 10, price: 20 }
    ];
    const result = auditInventoryClosing(mockSummary, products, [], "2024-01");
    
    expect(result.checklist.some(i => i.id === "inv_negative")).toBe(true);
    expect(result.healthScore.score).toBeLessThan(100);
    expect(result.timeline.length).toBeGreaterThan(0);
  });

  it("should detect missing cost", () => {
    const products: any[] = [
      { id: "1", name: "Sem Custo", stock: 10, minStock: 2, cost: 0, price: 20 }
    ];
    const result = auditInventoryClosing(mockSummary, products, [], "2024-01");
    expect(result.checklist.some(i => i.id === "inv_missing_cost")).toBe(true);
  });

  it("should detect ledger differences", () => {
    const ledger = [{ difference: 10, product_id: "1" }];
    const result = auditInventoryClosing(mockSummary, [], ledger, "2024-01");
    expect(result.checklist.some(i => i.id === "inv_ledger_diff")).toBe(true);
  });

  it("should return excellent score for perfect state", () => {
    const perfectSummary = { ...mockSummary, inventory: { data: { ...mockSummary.inventory.data, stagnantCount: 0, belowMinCount: 0 } } };
    const products: any[] = [
      { id: "1", name: "OK", stock: 10, minStock: 2, cost: 5, price: 10 }
    ];
    const result = auditInventoryClosing(perfectSummary as any, products, [], "2024-01");
    expect(result.healthScore.score).toBe(100);
  });
});
