import { describe, it } from "vitest";
import { runAuditRules } from "@/features/accounting-ai/audit";
import { makeAuditCashSession, makeAuditCustomer, makeAuditProduct, makeAuditSale, makeAuditTransaction } from "@/features/accounting-ai/tests/fixtures";
describe("dbg", () => {
  it("x", () => {
    const s = runAuditRules({
      today: "2026-02-10",
      transactions: [makeAuditTransaction(), makeAuditTransaction({ id: "t-pro", type: "expense", description: "Pró-labore fevereiro", referenceId: null })],
      sales: [makeAuditSale()],
      cashSessions: [makeAuditCashSession()],
      products: [makeAuditProduct()],
      customers: [makeAuditCustomer()],
      fiscalDocuments: [],
      fiscalDefaults: { defaultCst: "102" },
      stagnant: [],
      tax: null,
      summary: null,
      equity: 10000,
      netProfit: 5000,
    });
    console.log(JSON.stringify(s.findings.map((f) => [f.id, f.sample])));
  });
});
