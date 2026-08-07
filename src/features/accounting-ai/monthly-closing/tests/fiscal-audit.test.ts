import { describe, it, expect } from "vitest";
import { auditFiscalClosing } from "../queries/fiscal-audit";
import { AccountingSummary } from "../../types";
import { AuditFiscalDocumentRow, AuditProductRow } from "../../services/ports";

describe("auditFiscalClosing", () => {
  const mockSummary: AccountingSummary = {
    companyId: "test",
    period: { start: "2024-01-01", end: "2024-01-31" },
    generatedAt: new Date().toISOString(),
  } as any;

  it("should detect rejected fiscal documents", () => {
    const fiscalDocs: AuditFiscalDocumentRow[] = [
      { id: "1", status: "rejected", number: 123, rejectionReason: "CST inválido", saleId: "s1", xmlAuthorizedPath: null, danfePath: null }
    ];
    const products: AuditProductRow[] = [];
    
    const result = auditFiscalClosing(mockSummary, fiscalDocs, products, "2024-01");
    
    const rejectedItem = result.checklist.find(i => i.id === "fisc_rejected");
    expect(rejectedItem?.status).toBe("error");
    expect(result.healthScore.score).toBeLessThan(100);
    expect(result.timeline.length).toBeGreaterThan(0);
  });

  it("should detect products missing NCM", () => {
    const fiscalDocs: AuditFiscalDocumentRow[] = [];
    const products: AuditProductRow[] = [
      { id: "p1", name: "Produto Teste", ncm: "", sku: "SKU1", status: "active", stock: 10, minStock: 2, cost: 5, price: 10, unit: "UN", categoryId: "c1", marketplaceId: null }
    ];
    
    const result = auditFiscalClosing(mockSummary, fiscalDocs, products, "2024-01");
    
    const ncmItem = result.checklist.find(i => i.id === "fisc_missing_ncm");
    expect(ncmItem?.status).toBe("error");
    expect(result.healthScore.score).toBeLessThan(100);
  });

  it("should return excellent score when everything is perfect", () => {
    const fiscalDocs: AuditFiscalDocumentRow[] = [
      { id: "1", status: "authorized", number: 123, rejectionReason: null, saleId: "s1", xmlAuthorizedPath: "/xml", danfePath: "/pdf" }
    ];
    const products: AuditProductRow[] = [
      { id: "p1", name: "Produto Teste", ncm: "12345678", sku: "SKU1", status: "active", stock: 10, minStock: 2, cost: 5, price: 10, unit: "UN", categoryId: "c1", marketplaceId: null }
    ];
    
    const result = auditFiscalClosing(mockSummary, fiscalDocs, products, "2024-01");
    
    expect(result.healthScore.score).toBe(100);
    expect(result.healthScore.level).toBe("Exelente");
  });
});
