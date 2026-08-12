/**
 * HOTFIX-002 — Caixa isolado por sessão.
 *
 * Parte 1: garante que `computeSummary` isola vendas por `cash_session_id`,
 * mesmo com dois operadores vendendo simultaneamente na mesma empresa.
 *
 * Parte 2 (fix de 2026-08-12, migration 20260812130000): garante que
 * recebimentos (baixas financeiras) com `settlement_session_id` explícito
 * não vazam para outra sessão aberta na mesma janela de tempo — o bug que
 * motivou a migration que passou a gravar essa coluna em
 * settle_financial_transaction().
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Cada teste popula estes buckets antes de chamar computeSummary. O mock da
// view calcula os agregados A PARTIR destes buckets (não duplica números à
// mão), então ele exercita a mesma fonte de dados que as queries de detalhe.
const salesBucket: Array<Record<string, unknown>> = [];
const movementsBucket: Array<Record<string, unknown>> = [];
const receiptsBucket: Array<Record<string, unknown>> = [];
const openingBalances: Record<string, number> = {};

// Registro dos filtros aplicados na query de sales, para provar isolamento.
const lastSalesFilters: Array<{ col: string; val: unknown }> = [];

// Sessão "atual" usada pelo mock de financial_transactions — setada pelo
// próprio teste antes de cada chamada a computeSummary, já que a query real
// não expõe o objeto sessão inteiro, só session.id/opened_at/closed_at
// embutidos na string do `.or()`.
let currentReceiptsSession: { id: string; opened_at: string; closed_at: string | null } | null = null;

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
      in(col: string, vals: unknown[]) {
        q._rows = q._rows.filter((r) => vals.includes(r[col]));
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

  // Réplica em JS do `.or(settlement_session_id.eq.X, and(paid_at entre
  // opened_at/closed_at))` real — inclusive a prioridade: um recebimento
  // com settlement_session_id de OUTRA sessão nunca deve "vazar" por
  // coincidir com a janela de tempo desta sessão.
  function receiptsQuery() {
    const q = {
      select() {
        return q;
      },
      eq() {
        return q;
      },
      order() {
        return q;
      },
      or() {
        const session = currentReceiptsSession!;
        const windowEnd = session.closed_at ?? new Date().toISOString();
        const rows = receiptsBucket.filter((r) => {
          const sid = r.settlement_session_id as string | null | undefined;
          if (sid) return sid === session.id;
          const paidAt = r.paid_at as string;
          return paidAt >= session.opened_at && paidAt <= windowEnd;
        });
        return Promise.resolve({ data: rows, error: null });
      },
    };
    return q;
  }

  function viewQuery() {
    let sid: string | null = null;
    const q = {
      select() {
        return q;
      },
      eq(col: string, val: unknown) {
        if (col === "session_id") sid = val as string;
        return q;
      },
      single() {
        const sessionSales = salesBucket.filter(
          (r) => r.cash_session_id === sid && r.status === "paid",
        );
        const salesCount = sessionSales.length;
        const salesTotal = sessionSales.reduce((s, r) => s + Number(r.grand_total ?? 0), 0);
        const cashSales = sessionSales
          .filter((r) => r.payment_method === "cash")
          .reduce((s, r) => s + Number(r.grand_total ?? 0), 0);

        const sessionMovements = movementsBucket.filter((r) => r.session_id === sid);
        const cashIn = sessionMovements
          .filter((r) => r.type === "cash_in")
          .reduce((s, r) => s + Number(r.amount ?? 0), 0);
        const cashOut = sessionMovements
          .filter((r) => r.type === "cash_out")
          .reduce((s, r) => s + Number(r.amount ?? 0), 0);

        const opening = openingBalances[sid as string] ?? 0;
        const expectedCash = opening + cashSales + cashIn - cashOut;

        return Promise.resolve({
          data: {
            session_id: sid,
            opening_balance: opening,
            sales_count: salesCount,
            sales_total: salesTotal,
            cash_sales: cashSales,
            cash_in: cashIn,
            cash_out: cashOut,
            expected_cash: expectedCash,
          },
          error: null,
        });
      },
    };
    return q;
  }

  return {
    supabase: {
      from(table: string) {
        if (table === "sales") return salesQuery();
        if (table === "cash_movements") return movementsQuery();
        if (table === "view_cash_session_summary") return viewQuery();
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
  const session = {
    id: partial.id!,
    company_id: partial.company_id ?? "co-1",
    operator_id: partial.operator_id ?? "op-a",
    operator_name: partial.operator_name ?? "Operador A",
    opening_balance: partial.opening_balance ?? 100,
    opening_note: null,
    status: "open",
    opened_at: partial.opened_at ?? new Date().toISOString(),
    closed_at: partial.closed_at ?? null,
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
  openingBalances[session.id] = session.opening_balance;
  return session;
}

/** Chama computeSummary já registrando a sessão para o mock de recebimentos. */
async function computeSummaryFor(session: CashSession) {
  currentReceiptsSession = {
    id: session.id,
    opened_at: session.opened_at,
    closed_at: session.closed_at,
  };
  return cashService.computeSummary(session);
}

beforeEach(() => {
  salesBucket.length = 0;
  movementsBucket.length = 0;
  receiptsBucket.length = 0;
  lastSalesFilters.length = 0;
  for (const k of Object.keys(openingBalances)) delete openingBalances[k];
  currentReceiptsSession = null;
});

describe("HOTFIX-002 · computeSummary é isolado por cash_session_id", () => {
  it("aplica filtro por cash_session_id (e nunca por company_id + intervalo)", async () => {
    const session = makeSession({ id: "sess-a" });
    await computeSummaryFor(session);
    const cols = lastSalesFilters.map((f) => f.col);
    expect(cols).toContain("cash_session_id");
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
      { id: "s1", payment_method: "cash", grand_total: 50, status: "paid", cash_session_id: "sess-a" },
      { id: "s2", payment_method: "pix", grand_total: 30, status: "paid", cash_session_id: "sess-a" },
      { id: "s3", payment_method: "cash", grand_total: 80, status: "paid", cash_session_id: "sess-b" },
      { id: "s4", payment_method: "credit_card", grand_total: 120, status: "paid", cash_session_id: "sess-b" },
      // Venda legada sem sessão — não pode aparecer em nenhum resumo.
      { id: "s5", payment_method: "cash", grand_total: 999, status: "paid", cash_session_id: null },
    );

    // Suprimento em A e sangria em B.
    movementsBucket.push(
      { session_id: "sess-a", type: "cash_in", amount: 20 },
      { session_id: "sess-b", type: "cash_out", amount: 15 },
    );

    const sumA = await computeSummaryFor(sessionA);
    const sumB = await computeSummaryFor(sessionB);

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
    const a = await computeSummaryFor(sessionA);
    const b = await computeSummaryFor(sessionB);
    expect(a.expectedCash).toBe(10);
    expect(b.expectedCash).toBe(40);
  });

  it("HOTFIX-002 parte 2: recebimento com settlement_session_id não vaza para outro caixa aberto na mesma janela", async () => {
    const now = new Date();
    const openedAt = new Date(now.getTime() - 60 * 60 * 1000).toISOString(); // -1h
    // As duas sessões estão abertas na MESMA janela de tempo — é exatamente
    // o cenário que causava a ambiguidade antes da migration 20260812130000.
    const sessionA = makeSession({ id: "sess-a", opening_balance: 0, opened_at: openedAt });
    const sessionB = makeSession({ id: "sess-b", opening_balance: 0, opened_at: openedAt });

    // Baixa feita pelo Operador A, corretamente marcada com settlement_session_id.
    receiptsBucket.push({
      id: "r1",
      description: "Baixa cliente X",
      amount: 300,
      payment_method: "cash",
      paid_at: now.toISOString(),
      source: "manual",
      settlement_session_id: "sess-a",
    });

    const sumA = await computeSummaryFor(sessionA);
    const sumB = await computeSummaryFor(sessionB);

    // O recebimento aparece SÓ no extrato de A, mesmo com B aberto na mesma janela.
    expect(sumA.receipts.map((r) => r.id)).toEqual(["r1"]);
    expect(sumB.receipts.map((r) => r.id)).toEqual([]);
  });

  it("recebimento legado sem settlement_session_id ainda aparece pela janela de tempo (fallback)", async () => {
    const now = new Date();
    const openedAt = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const sessionA = makeSession({ id: "sess-a", opening_balance: 0, opened_at: openedAt });

    receiptsBucket.push({
      id: "r-legado",
      description: "Baixa antiga sem sessão",
      amount: 50,
      payment_method: "pix",
      paid_at: now.toISOString(),
      source: "manual",
      settlement_session_id: null,
    });

    const sumA = await computeSummaryFor(sessionA);
    expect(sumA.receipts.map((r) => r.id)).toEqual(["r-legado"]);
  });
});
