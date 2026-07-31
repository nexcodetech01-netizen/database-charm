/**
 * HOTFIX-001 — Testes de idempotência e promoção server-side da venda
 * no webhook Bella Pay.
 *
 * Cenários cobertos:
 *  - PAYMENT_RECEIVED com sale_id → promove sale para 'paid' (sem navegador)
 *  - Reentrega do MESMO evento → idempotente (não repromove)
 *  - Cobrança avulsa (sem sale) → cria financial_transaction
 *  - Valor divergente → NÃO baixa finanças nem promove venda
 *  - Evento desconhecido → ignora sem quebrar
 *  - Cancelamento (PAYMENT_DELETED) → não promove venda
 */
import { describe, it, expect } from "vitest";
import {
  handleWebhookEvent,
  type AdminLike,
  type ChargeRow,
  type WebhookPayload,
} from "../lib/webhook-handler";

// -----------------------------------------------------------------------------
// Fake admin client em memória (subset da API do supabase-js suficiente para
// o handler). Cada teste cria a sua própria instância.
// -----------------------------------------------------------------------------
type Row = Record<string, unknown>;

function createFakeAdmin(seed: {
  charges?: Row[];
  sales?: Row[];
  financial_transactions?: Row[];
}) {
  const tables: Record<string, Row[]> = {
    bella_pay_charges: [...(seed.charges ?? [])],
    sales: [...(seed.sales ?? [])],
    financial_transactions: [...(seed.financial_transactions ?? [])],
  };
  const alias: Record<string, Row[]> = { ...tables, charges: tables.bella_pay_charges };


  const admin: AdminLike = {
    from(table: string) {
      const rows = () => (tables[table] ??= []);
      return {
        update(patch: Row) {
          const filters: Array<
            | { op: "eq"; col: string; val: unknown }
            | { op: "neq"; col: string; val: unknown }
          > = [];
          const apply = () => {
            const list = rows();
            const affected: Row[] = [];
            for (const r of list) {
              if (
                filters.every((f) =>
                  f.op === "eq" ? r[f.col] === f.val : r[f.col] !== f.val,
                )
              ) {
                Object.assign(r, patch);
                affected.push(r);
              }
            }
            return affected;
          };
          const builder = {
            eq(col: string, val: unknown) {
              filters.push({ op: "eq", col, val });
              return builder;
            },
            neq(col: string, val: unknown) {
              filters.push({ op: "neq", col, val });
              return builder;
            },
            select(_cols?: string) {
              return {
                async maybeSingle() {
                  const affected = apply();
                  return { data: affected[0] ?? null, error: null };
                },
              };
            },
            // Await sem .select() → executa o update e devolve {error:null}.
            then(onFulfilled: (v: { error: null }) => unknown) {
              apply();
              return Promise.resolve({ error: null }).then(onFulfilled);
            },
          };
          return builder as never;
        },
        insert(row: Row) {
          const rowWithId = { id: `gen-${rows().length + 1}`, ...row };
          rows().push(rowWithId);
          return {
            select(_cols?: string) {
              return {
                async single() {
                  return { data: rowWithId, error: null };
                },
              };
            },
          } as never;
        },
        select(_cols?: string) {
          const filters: Array<{ col: string; val: unknown }> = [];
          const builder = {
            eq(col: string, val: unknown) {
              filters.push({ col, val });
              return builder;
            },
            async maybeSingle() {
              const found = rows().find((r) =>
                filters.every((f) => r[f.col] === f.val),
              );
              return { data: found ?? null, error: null };
            },
          };
          return builder as never;
        },
      };
    },
  };

  return { admin, tables: alias };
}

const baseCharge = (overrides: Partial<ChargeRow> = {}): ChargeRow => ({
  id: "chg-1",
  company_id: "co-1",
  customer_id: "cus-1",
  sale_id: "sale-1",
  financial_transaction_id: null,
  description: "Venda 001",
  value: 150,
  status: "PENDING",
  ...overrides,
});

const paymentReceivedPayload: WebhookPayload = {
  id: "evt-1",
  event: "PAYMENT_RECEIVED",
  payment: {
    id: "pay-1",
    status: "RECEIVED",
    value: 150,
    paymentDate: "2026-07-14",
  },
};

describe("HOTFIX-001 · handleWebhookEvent — promoção server-side da venda", () => {
  it("PAYMENT_RECEIVED com sale_id promove sale para 'paid' sem depender do navegador", async () => {
    const { admin, tables } = createFakeAdmin({
      charges: [{ ...baseCharge() }],
      sales: [
        {
          id: "sale-1",
          status: "pending",
          finance_ref: null,
          paid_at: null,
          payment_confirmed_at: null,
        },
      ],
    });

    const result = await handleWebhookEvent(
      admin,
      "PAYMENT_RECEIVED",
      paymentReceivedPayload,
      baseCharge(),
    );

    expect(result.salePromoted).toBe(true);
    expect(result.valueMismatch).toBeFalsy();
    expect(tables.sales[0].status).toBe("paid");
    expect(tables.sales[0].payment_confirmed_at).toBeTruthy();
    expect(tables.sales[0].paid_at).toBeTruthy();
    expect(tables.charges[0].status).toBe("RECEIVED");
    expect(tables.charges[0].paid_at).toBeTruthy();
  });

  it("reentrega do MESMO PAYMENT_RECEIVED é idempotente (não repromove venda já paga)", async () => {
    const alreadyPaidSale = {
      id: "sale-1",
      status: "paid",
      finance_ref: "ft-existing",
      paid_at: "2026-07-14T10:00:00Z",
      payment_confirmed_at: "2026-07-14T10:00:00Z",
    };
    const { admin, tables } = createFakeAdmin({
      charges: [{ ...baseCharge({ status: "RECEIVED" }) }],
      sales: [alreadyPaidSale],
    });

    const result = await handleWebhookEvent(
      admin,
      "PAYMENT_RECEIVED",
      paymentReceivedPayload,
      baseCharge({ status: "RECEIVED" }),
    );

    // A venda já está 'paid'; o UPDATE ... .neq('status','paid') não afeta
    // nenhuma linha, então salePromoted=false — idempotência garantida.
    expect(result.salePromoted).toBe(false);
    expect(tables.sales[0].paid_at).toBe("2026-07-14T10:00:00Z");
    expect(tables.sales[0].status).toBe("paid");
  });

  it("cobrança avulsa (sem sale_id) cria financial_transaction e vincula na charge", async () => {
    const orphanCharge = baseCharge({ sale_id: null });
    const { admin, tables } = createFakeAdmin({
      charges: [{ ...orphanCharge }],
    });

    const result = await handleWebhookEvent(
      admin,
      "PAYMENT_RECEIVED",
      paymentReceivedPayload,
      orphanCharge,
    );

    expect(result.financialTransactionId).toBeTruthy();
    expect(tables.financial_transactions).toHaveLength(1);
    expect(tables.financial_transactions[0].amount).toBe(150);
    expect(tables.charges[0].financial_transaction_id).toBe(
      result.financialTransactionId,
    );
  });

  it("valor divergente bloqueia baixa financeira E promoção da venda", async () => {
    const { admin, tables } = createFakeAdmin({
      charges: [{ ...baseCharge() }],
      sales: [
        {
          id: "sale-1",
          status: "pending",
          finance_ref: null,
          paid_at: null,
        },
      ],
    });

    const mismatched: WebhookPayload = {
      ...paymentReceivedPayload,
      payment: { ...paymentReceivedPayload.payment, value: 100 },
    };

    const result = await handleWebhookEvent(
      admin,
      "PAYMENT_RECEIVED",
      mismatched,
      baseCharge(),
    );

    expect(result.valueMismatch).toBe(true);
    expect(tables.sales[0].status).toBe("pending");
    expect(tables.sales[0].paid_at).toBeNull();
  });

  it("evento desconhecido é ignorado sem tocar em nenhuma tabela", async () => {
    const { admin, tables } = createFakeAdmin({
      charges: [{ ...baseCharge() }],
      sales: [{ id: "sale-1", status: "pending" }],
    });

    const result = await handleWebhookEvent(
      admin,
      "PAYMENT_MADE_UP",
      { event: "PAYMENT_MADE_UP" },
      baseCharge(),
    );

    expect(result.note).toBe("unknown_event");
    expect(tables.sales[0].status).toBe("pending");
    expect(tables.charges[0].status).toBe("PENDING");
  });

  it("PAYMENT_DELETED cancela a charge mas NÃO promove a venda", async () => {
    const { admin, tables } = createFakeAdmin({
      charges: [{ ...baseCharge() }],
      sales: [{ id: "sale-1", status: "pending", paid_at: null }],
    });

    await handleWebhookEvent(
      admin,
      "PAYMENT_DELETED",
      { event: "PAYMENT_DELETED", payment: { id: "pay-1" } },
      baseCharge(),
    );

    expect(tables.charges[0].status).toBe("CANCELED");
    expect(tables.charges[0].canceled_at).toBeTruthy();
    expect(tables.sales[0].status).toBe("pending");
  });
});
