import { describe, expect, it } from "vitest";
import {
  accountingAdapter,
  accountingAiServices,
  auditAdapter,
  cashAdapter,
  financeAdapter,
  fiscalAdapter,
  inventoryAdapter,
  salesAdapter,
} from "../services/adapters";
import { makeTestServices } from "./fixtures";

/**
 * Testes de CONTRATO (Sprint 7.2.1).
 *
 * Garantem que os adaptadores reais e os fakes de teste expõem exatamente
 * a mesma superfície das Portas. Nenhuma chamada de rede é feita aqui: o
 * contrato é validado por shape, não por execução contra o Supabase.
 */
const CONTRACT: Record<string, string[]> = {
  accounting: ["dre", "balanceSheet", "kpis", "monthlyEvolution"],
  finance: ["snapshot"],
  sales: ["metrics", "products", "customers"],
  inventory: ["metrics"],
  fiscal: [
    "monthlyRevenue",
    "apportionments",
    "profile",
    "rbt12",
    "apportionment",
    "simulateSimples",
    "projectScenarios",
  ],
  cash: ["listSessions"],
  audit: [
    "transactions",
    "sales",
    "cashSessions",
    "products",
    "customers",
    "fiscalDocuments",
    "fiscalDefaults",
    "stagnantProducts",
  ],
};

const REAL: Record<string, Record<string, unknown>> = {
  accounting: accountingAdapter as unknown as Record<string, unknown>,
  finance: financeAdapter as unknown as Record<string, unknown>,
  sales: salesAdapter as unknown as Record<string, unknown>,
  inventory: inventoryAdapter as unknown as Record<string, unknown>,
  fiscal: fiscalAdapter as unknown as Record<string, unknown>,
  cash: cashAdapter as unknown as Record<string, unknown>,
  audit: auditAdapter as unknown as Record<string, unknown>,
};

describe("accounting-ai · contratos dos adaptadores", () => {
  it("o bundle de produção implementa todas as portas", () => {
    expect(Object.keys(accountingAiServices).sort()).toEqual(
      Object.keys(CONTRACT).sort(),
    );
  });

  for (const [port, methods] of Object.entries(CONTRACT)) {
    it(`porta ${port}: adaptador real expõe exatamente os métodos previstos`, () => {
      const adapter = REAL[port];
      expect(Object.keys(adapter).sort()).toEqual([...methods].sort());
      for (const m of methods) expect(typeof adapter[m]).toBe("function");
    });

    it(`porta ${port}: fixture de teste espelha o adaptador real`, () => {
      const fake = makeTestServices() as unknown as Record<
        string,
        Record<string, unknown>
      >;
      for (const m of methods) expect(typeof fake[port][m]).toBe("function");
    });
  }

  it("os adaptadores são delegates finos (sem estado próprio)", () => {
    for (const adapter of Object.values(REAL)) {
      for (const value of Object.values(adapter)) {
        expect(typeof value).toBe("function");
      }
    }
  });
});
