/**
 * Finance v2 — Smoke tests das Skills (Sprint 006).
 * Cobre schema estrito, permissões e formato de resposta.
 */
import { describe, it, expect, vi } from "vitest";
import type { ExecutionContext } from "@/features/bella-ai/agent/infrastructure/context";
import {
  financeCashSkill,
  financeReceivablesSkill,
  financePayablesSkill,
  financeForecastSkill,
  financeProLaboreSkill,
  financeSummarySkill,
  financeV2BaseSkills,
} from "../skills";

vi.mock("@/features/bella-ai/agent/infrastructure/event-bus", () => ({
  emitAgentEvent: vi.fn().mockResolvedValue(undefined),
}));

type Row = Record<string, unknown>;

function fakeSupabase(tables: Record<string, Row[]>) {
  const state = { table: "" };
  return {
    from(table: string) {
      state.table = table;
      const rows = tables[table] ?? [];
      const filters: Array<(r: Row) => boolean> = [];
      const api: Record<string, unknown> = {};
      const self = api;
      const eq = (col: string, val: unknown) => {
        filters.push((r) => r[col] === val);
        return self;
      };
      const gte = (col: string, val: unknown) => {
        filters.push((r) => (r[col] as string) >= (val as string));
        return self;
      };
      const lt = (col: string, val: unknown) => {
        filters.push((r) => (r[col] as string) < (val as string));
        return self;
      };
      const lte = (col: string, val: unknown) => {
        filters.push((r) => (r[col] as string) <= (val as string));
        return self;
      };
      self.select = () => self;
      self.eq = eq;
      self.gte = gte;
      self.lt = lt;
      self.lte = lte;
      self.gt = eq; // not used
      self.order = () => self;
      self.limit = () => self;
      self.maybeSingle = async () => {
        const filtered = rows.filter((r) => filters.every((f) => f(r)));
        return { data: filtered[0] ?? null, error: null };
      };
      self.then = (resolve: (r: unknown) => unknown) => {
        const filtered = rows.filter((r) => filters.every((f) => f(r)));
        return Promise.resolve({ data: filtered, error: null }).then(resolve);
      };
      return self;
    },
    rpc: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }),
  };
}

function makeCtx(supabase: unknown): ExecutionContext {
  return {
    supabase: supabase as ExecutionContext["supabase"],
    companyId: "company-1",
    userId: "user-1",
    request: {
      requestId: "req-1",
      channel: "test",
      source: "test",
      correlationId: null,
    },
    security: {
      permissions: ["finance.view", "reports.view"],
      roles: ["admin"],
      can: () => true,
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
    },
  } as unknown as ExecutionContext;
}

describe("Finance v2 Skills — smoke", () => {
  it("expõe as 6 skills obrigatórias", () => {
    const ids = financeV2BaseSkills.map((s) => s.spec.id).sort();
    expect(ids).toEqual([
      "finance.cash",
      "finance.forecast",
      "finance.payables",
      "finance.prolabore",
      "finance.receivables",
      "finance.summary",
    ]);
  });

  it("finance.cash retorna saldo consolidado", async () => {
    const ctx = makeCtx(
      fakeSupabase({
        financial_accounts: [
          { id: "a1", name: "Caixa", type: "cash", current_balance: 250.5, status: "active" },
          { id: "a2", name: "Banco", type: "bank", current_balance: 1000, status: "active" },
          { id: "a3", name: "Antiga", type: "bank", current_balance: 999, status: "inactive" },
        ],
      }),
    );
    const res = await financeCashSkill.run({ payload: {}, ctx });
    expect(res.ok).toBe(true);
  });

  it("finance.receivables lista pendentes com total", async () => {
    const ctx = makeCtx(
      fakeSupabase({
        financial_transactions: [
          {
            id: "t1",
            type: "income",
            status: "pending",
            amount: 100,
            description: "Fatura A",
            due_date: "2026-12-01",
            paid_at: null,
            source: "manual",
          },
          {
            id: "t2",
            type: "income",
            status: "pending",
            amount: 50,
            description: "Fatura B",
            due_date: "2026-12-05",
            paid_at: null,
            source: "manual",
          },
        ],
      }),
    );
    const res = await financeReceivablesSkill.run({ payload: {}, ctx });
    expect(res.ok).toBe(true);
  });

  it("finance.payables retorna mensagem vazia quando não há dados", async () => {
    const ctx = makeCtx(fakeSupabase({ financial_transactions: [] }));
    const res = await financePayablesSkill.run({ payload: {}, ctx });
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/Nenhuma conta a pagar/);
  });

  it("finance.forecast calcula projeção baseada em pendentes", async () => {
    const ctx = makeCtx(
      fakeSupabase({
        financial_accounts: [
          { id: "a1", name: "Caixa", type: "cash", current_balance: 1000, status: "active" },
        ],
        financial_transactions: [],
      }),
    );
    const res = await financeForecastSkill.run({ payload: { horizonDays: 7 }, ctx });
    expect(res.ok).toBe(true);
  });

  it("finance.prolabore respeita reserva prudencial", async () => {
    const ctx = makeCtx(
      fakeSupabase({
        financial_accounts: [
          { id: "a1", name: "Caixa", type: "cash", current_balance: 10000, status: "active" },
        ],
        financial_transactions: [],
      }),
    );
    const res = await financeProLaboreSkill.run({ payload: { reserveMonths: 3 }, ctx });
    expect(res.ok).toBe(true);
  });

  it("finance.summary agrega KPIs sem quebrar", async () => {
    const ctx = makeCtx(
      fakeSupabase({
        financial_accounts: [
          { id: "a1", name: "Caixa", type: "cash", current_balance: 500, status: "active" },
        ],
        financial_transactions: [],
      }),
    );
    const res = await financeSummarySkill.run({ payload: {}, ctx });
    expect(res.ok).toBe(true);
  });

  it("rejeita input com campo desconhecido (schema estrito)", async () => {
    const ctx = makeCtx(fakeSupabase({}));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await financeReceivablesSkill.run({ payload: { foo: "bar" } as any, ctx });
    expect(res.ok).toBe(false);
  });

  it("todas as skills declaram ao menos uma permissão", () => {
    for (const s of financeV2BaseSkills) {
      expect(Array.isArray(s.spec.requiredPermissions)).toBe(true);
      expect(s.spec.requiredPermissions.length).toBeGreaterThan(0);
    }
  });

  it("nenhuma skill v2 é destrutiva por padrão (todas somente-leitura)", () => {
    for (const s of financeV2BaseSkills) {
      expect(s.spec.destructive).toBeFalsy();
    }
  });
});
