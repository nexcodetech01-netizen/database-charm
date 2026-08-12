import { describe, it, expect } from "vitest";
import { auditPurchasesClosing } from "../queries/purchases-audit";
import { AccountingSummary } from "../../types";
import { AuditPurchaseRow, AuditProductRow, AuditSupplierRow } from "../../services/ports";

describe("auditPurchasesClosing", () => {
  const mockSummary: AccountingSummary = {
    companyId: "test",
    period: { start: "2024-01-01", end: "2024-01-31" },
    generatedAt: new Date().toISOString(),
    inventory: { data: { productCount: 10, stagnantCount: 0, inventoryValue: 1000, belowMinCount: 0 } }
  } as any;

  it("should detect delayed purchases", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const purchases: AuditPurchaseRow[] = [
      { 
        id: "1", 
        number: "PUR-001", 
        status: "pending", 
        grandTotal: 500, 
        purchaseDate: yesterdayStr, 
        supplierId: "s1", 
        supplierName: "Fornecedor A", 
        itemsCount: 5, 
        hasFinance: true, 
        hasDocument: true 
      }
    ];
    
    const result = auditPurchasesClosing(mockSummary, purchases, [], [], "2024-01");
    
    const delayedItem = result.checklist.find(i => i.id === "pur_delayed");
    expect(delayedItem?.status).toBe("error");
    expect(result.healthScore.score).toBeLessThan(100);
    expect(result.timeline.length).toBeGreaterThan(0);
  });

  it("should detect purchases without finance", () => {
    const purchases: AuditPurchaseRow[] = [
      { 
        id: "2", 
        number: "PUR-002", 
        status: "received", 
        grandTotal: 1000, 
        purchaseDate: "2024-01-10", 
        supplierId: "s1", 
        supplierName: "Fornecedor A", 
        itemsCount: 10, 
        hasFinance: false, 
        hasDocument: true 
      }
    ];
    
    const result = auditPurchasesClosing(mockSummary, purchases, [], [], "2024-01");
    
    const noFinanceItem = result.checklist.find(i => i.id === "pur_no_finance");
    expect(noFinanceItem?.status).toBe("error");
    expect(result.healthScore.score).toBeLessThan(100);
  });

  it("should return excellent score when everything is perfect", () => {
    const purchases: AuditPurchaseRow[] = [
      { 
        id: "3", 
        number: "PUR-003", 
        status: "received", 
        grandTotal: 200, 
        purchaseDate: "2024-01-15", 
        supplierId: "s1", 
        supplierName: "Fornecedor A", 
        itemsCount: 2, 
        hasFinance: true, 
        hasDocument: true 
      }
    ];
    const products: AuditProductRow[] = [
      { id: "p1", name: "Produto Teste", ncm: "12345678", sku: "SKU1", status: "active", stock: 10, minStock: 2, cost: 5, price: 10, unit: "UN", categoryId: "c1", marketplaceId: null }
    ];
    const suppliers: AuditSupplierRow[] = [
      { id: "s1", name: "Fornecedor A", status: "active" }
    ];
    
    const result = auditPurchasesClosing(mockSummary, purchases, products, suppliers, "2024-01");
    
    expect(result.healthScore.score).toBe(100);
    expect(result.healthScore.level).toBe("Excelente");
  });
});
