import { describe, it, expect } from "vitest";
import { auditSalesClosing } from "../queries/sales-audit";
import { AccountingSummary } from "../../types";
import { AuditSaleRow, AuditProductRow, AuditCustomerRow } from "../../services/ports";

describe("auditSalesClosing", () => {
  const mockSummary: AccountingSummary = {
    companyId: "test",
    period: { start: "2024-01-01", end: "2024-01-31" },
    generatedAt: new Date().toISOString(),
    sales: { data: { monthTotal: 10000, monthCount: 50, averageTicket: 200 } }
  } as any;

  it("should detect cancelled sales", () => {
    const sales: AuditSaleRow[] = [
      { id: "s1", number: "101", status: "cancelled", total: 100, saleDate: "2024-01-05", customerId: "c1", paidAt: null, settledAt: null }
    ];
    
    const result = auditSalesClosing(mockSummary, sales, [], [], "2024-01");
    
    const cancelledItem = result.checklist.find(i => i.id === "sale_cancelled");
    expect(cancelledItem?.status).toBe("warning");
    expect(result.healthScore.score).toBeLessThan(100);
    expect(result.timeline.length).toBeGreaterThan(0);
  });

  it("should detect unconciliated sales", () => {
    const sales: AuditSaleRow[] = [
      { id: "s2", number: "102", status: "paid", total: 500, saleDate: "2024-01-10", customerId: "c2", paidAt: "2024-01-10", settledAt: null }
    ];
    
    const result = auditSalesClosing(mockSummary, sales, [], [], "2024-01");
    
    const unconciliatedItem = result.checklist.find(i => i.id === "sale_unconciliated");
    expect(unconciliatedItem?.status).toBe("error");
    expect(result.healthScore.score).toBeLessThan(100);
  });

  it("should detect unpaid sales", () => {
    const sales: AuditSaleRow[] = [
      { id: "s3", number: "103", status: "pending", total: 200, saleDate: "2024-01-15", customerId: "c3", paidAt: null, settledAt: null }
    ];
    
    const result = auditSalesClosing(mockSummary, sales, [], [], "2024-01");
    
    const unpaidItem = result.checklist.find(i => i.id === "sale_unpaid");
    expect(unpaidItem?.status).toBe("error");
  });

  it("should return excellent score when everything is perfect", () => {
    const sales: AuditSaleRow[] = [
      { id: "s4", number: "104", status: "paid", total: 300, saleDate: "2024-01-20", customerId: "c4", paidAt: "2024-01-20", settledAt: "2024-01-20" }
    ];
    const products: AuditProductRow[] = [
      { id: "p1", name: "Produto A", sku: "A", status: "active", stock: 10, minStock: 2, cost: 5, price: 12, unit: "un", ncm: "61091000", categoryId: "cat1", marketplaceId: null }
    ];
    
    const result = auditSalesClosing(mockSummary, sales, products, [], "2024-01");
    
    expect(result.healthScore.score).toBe(100);
    expect(result.healthScore.level).toBe("Excelente");
  });
});
