/**
 * HOTFIX-002 — Caixa isolado por sessão.
 *
 * Garante que `computeSummary` filtra vendas EXCLUSIVAMENTE por
 * `cash_session_id`, mesmo com dois operadores vendendo simultaneamente
 * na mesma empresa.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Cada teste popula estes buckets antes de chamar computeSummary.
const salesBucket: Array<Record<string, unknown>> = [];
const movementsBucket: Array<Record<string, unknown>> = [];

// Registro dos filtros aplicados na query de sales, para provar isolamento.
const lastSalesFilters: Array<{ col: string; val: unknown }> = [];

vi.mock("@/integrations/supabase/client", () => {
  function salesQuery() {
    lastSalesFilters.length = 0;
    const q = {
      _rows: salesBucket,
      select() {
        return q;
      },
      eq(col: string, val: unknown) {
        lastSalesFilters.push({ col, val });
        q._rows = q._rows.filter((r) => r[col] === val);
        return q;
      },
      order() {
        return q;
      },
      then(resolve: (v: { data: unknown[]; error: null }) => void) {
        resolve({ data: q._rows, error: null });
      },
    };
    return q;
  }
  function movementsQuery() {
    const q = {
      _rows: movementsBucket,
      select() {
        return q;
      },
      eq(col: string, val: unknown) {
        q._rows = q._rows.filter((r) => r[col] === val);
        return q;
      },
      order() {
        return q;
      },
      then(resolve: (v: { data: unknown[]; error: null }) => void) {
        resolve({ data: q._rows, error: null });
      },
    };
    return q;
  }
  function receiptsQuery() {
    const q = {
      _rows: [] as Array<Record<string, unknown>>,
      select() {
        return q;
      },
      eq() {
        return q;
      },
      gte() {
        return q;
      },
      lte() {
        return q;
      },
      order() {
        return q;
      },
      then(resolve: (v: { data: unknown[]; error: null }) => void) {
        resolve({ data: q._rows, error: null });
      },
    };
    return q;
  }
  return {
    supabase: {
      from(table: string) {
        if (table === "sales") return salesQuery();
        if (table === "cash_movements") return movementsQuery();
        if (table === "financial_transactions") return receiptsQuery();
        throw new Error(`unexpected table ${table}`);
      },
    },
  };
});


// Importar depois do mock.
import { cashService } from "../services/cash.service";
import type { CashSession } from "../types";

function makeSession(partial: Partial<CashSession>): CashSession {
  return {
    id: partial.id!,
    company_id: partial.company_id ?? "co-1",
    operator_id: partial.operator_id ?? "op-a",
    operator_name: partial.operator_name ?? "Operador A",
    opening_balance: partial.opening_balance ?? 100,
    opening_note: null,
    status: "open",
    opened_at: partial.opened_at ?? new Date().toISOString(),
    closed_at: null,
    counted_cash: null,
    expected_cash: null,
    difference: null,
    closing_note: null,
    sales_count: null,
    sales_total: null,
    cash_in_total: null,
    cash_out_total: null,
    by_method: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as CashSession;
}

beforeEach(() => {
  salesBucket.length = 0;
  movementsBucket.length = 0;
  lastSalesFilters.length = 0;
});

describe("HOTFIX-002 · computeSummary é isolado por cash_session_id", () => {
  it("aplica filtro por cash_session_id (e nunca por company_id + intervalo)", async () => {
    const session = makeSession({ id: "sess-a" });
    await cashService.computeSummary(session);
    const cols = lastSalesFilters.map((f) => f.col);
    expect(cols).toContain("cash_session_id");
    expect(cols).toContain("status");
    expect(cols).not.toContain("company_id");
    const csi = lastSalesFilters.find((f) => f.col === "cash_session_id");
    expect(csi?.val).toBe("sess-a");
  });

  it("dois operadores, dois caixas, vendas simultâneas → nenhuma venda misturada", async () => {
    // Sessão A (Operador A) e Sessão B (Operador B), mesma empresa.
    const sessionA = makeSession({
      id: "sess-a",
      operator_id: "op-a",
      opening_balance: 100,
    });
    const sessionB = makeSession({
      id: "sess-b",
      operator_id: "op-b",
      opening_balance: 200,
    });

    // Vendas de A (cash 50 + pix 30) e B (cash 80 + credit_card 120)
    salesBucket.push(
      {
        id: "s1",
        payment_method: "cash",
        grand_total: 50,
        status: "paid",
        cash_session_id: "sess-a",
      },
      {
        id: "s2",
        payment_method: "pix",
        grand_total: 30,
        status: "paid",
        cash_session_id: "sess-a",
      },
      {
        id: "s3",
        payment_method: "cash",
        grand_total: 80,
        status: "paid",
        cash_session_id: "sess-b",
      },
      {
        id: "s4",
        payment_method: "credit_card",
        grand_total: 120,
        status: "paid",
        cash_session_id: "sess-b",
      },
      // Venda legada sem sessão — não pode aparecer em nenhum resumo.
      {
        id: "s5",
        payment_method: "cash",
        grand_total: 999,
        status: "paid",
        cash_session_id: null,
      },
    );

    // Suprimento em A e sangria em B.
    movementsBucket.push(
      { session_id: "sess-a", type: "cash_in", amount: 20 },
      { session_id: "sess-b", type: "cash_out", amount: 15 },
    );

    const sumA = await cashService.computeSummary(sessionA);
    const sumB = await cashService.computeSummary(sessionB);

    // Operador A: 2 vendas, R$ 80 total; cash 50; dinheiro esperado = 100 + 20 + 50 = 170
    expect(sumA.salesCount).toBe(2);
    expect(sumA.salesTotal).toBe(80);
    expect(sumA.byMethod.cash.total).toBe(50);
    expect(sumA.byMethod.pix.total).toBe(30);
    expect(sumA.byMethod.credit_card.total).toBe(0);
    expect(sumA.cashIn).toBe(20);
    expect(sumA.cashOut).toBe(0);
    expect(sumA.expectedCash).toBe(170);

    // Operador B: 2 vendas, R$ 200 total; cash 80; dinheiro esperado = 200 - 15 + 80 = 265
    expect(sumB.salesCount).toBe(2);
    expect(sumB.salesTotal).toBe(200);
    expect(sumB.byMethod.cash.total).toBe(80);
    expect(sumB.byMethod.credit_card.total).toBe(120);
    expect(sumB.byMethod.pix.total).toBe(0);
    expect(sumB.cashIn).toBe(0);
    expect(sumB.cashOut).toBe(15);
    expect(sumB.expectedCash).toBe(265);

    // Venda legada (s5) não vazou para nenhum dos resumos.
    expect(sumA.salesTotal + sumB.salesTotal).toBe(280);
  });

  it("fechar A não afeta o resumo de B (e vice-versa)", async () => {
    const sessionA = makeSession({ id: "sess-a", opening_balance: 0 });
    const sessionB = makeSession({ id: "sess-b", opening_balance: 0 });
    salesBucket.push(
      { id: "a1", payment_method: "cash", grand_total: 10, status: "paid", cash_session_id: "sess-a" },
      { id: "b1", payment_method: "cash", grand_total: 40, status: "paid", cash_session_id: "sess-b" },
    );
    const a = await cashService.computeSummary(sessionA);
    const b = await cashService.computeSummary(sessionB);
    expect(a.expectedCash).toBe(10);
    expect(b.expectedCash).toBe(40);
  });
});
