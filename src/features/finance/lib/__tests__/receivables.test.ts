/**
 * receivables.ts — agrupamento de crediário (entrada paga + saldo pendente).
 *
 * Bug real (2026-08-13): o RPC create_credit_sale reatribui o
 * `reference_id` da entrada do crediário para o registro de pagamento
 * (credit_payments.id) em vez de manter a venda — enquanto o saldo
 * pendente da mesma venda mantém `reference_id = venda`. Isso quebrava
 * o agrupamento por `reference_id`: a Financeiro mostrava o saldo
 * pendente sozinho como "Vencido", sem indicar que a entrada já tinha
 * sido paga (o dinheiro estava certo no banco, só a exibição errava).
 *
 * `reference_number` (o número legível da venda) continua igual nos
 * dois lançamentos mesmo quando `reference_id` diverge — por isso
 * groupByReference/deriveGroupStatus agora agrupam por ele.
 */
import { describe, it, expect } from "vitest";
import { deriveGroupStatus, groupByReference } from "../receivables";
import type { TransactionWithMeta } from "../../types";

function tx(over: Partial<TransactionWithMeta> & { reference_number?: string | null }): TransactionWithMeta {
  return {
    id: "tx-" + Math.random().toString(36).slice(2),
    company_id: "c1",
    type: "income",
    description: "",
    amount: 100,
    status: "pending",
    due_date: null,
    transaction_date: "2026-08-01",
    reference_id: null,
    account_id: null,
    category_id: null,
    payment_method: null,
    notes: null,
    source: "sale",
    account_name: null,
    category_name: null,
    ...over,
  } as unknown as TransactionWithMeta;
}

describe("receivables · agrupamento de crediário", () => {
  it("mostra 'partial' quando a entrada (reference_id reatribuído) e o saldo pendente compartilham reference_number", () => {
    const down = tx({
      id: "ft-entrada",
      reference_id: "payment-xyz", // reatribuído pelo RPC, não é mais a venda
      reference_number: "PDV-20260807-213427",
      status: "paid",
      amount: 50,
      source: "credit_payment",
    });
    const balance = tx({
      id: "ft-saldo",
      reference_id: "sale-123", // continua apontando pra venda
      reference_number: "PDV-20260807-213427",
      status: "pending",
      amount: 96,
      due_date: "2026-07-01", // vencido
      source: "sale",
    });

    const rows = [down, balance];
    const groups = groupByReference(rows);

    expect(deriveGroupStatus(balance, groups)).toBe("partial");
    // A entrada paga também aparece como "Parcial" enquanto o grupo tiver
    // uma parte pendente — é o mesmo comportamento já existente pra
    // qualquer grupo misto (não é exclusivo do bug do crediário).
    expect(deriveGroupStatus(down, groups)).toBe("partial");
  });

  it("sem reference_number em comum, cai de volta pro status individual (comportamento antigo preservado)", () => {
    const a = tx({ id: "a", reference_id: "s1", reference_number: null, status: "paid" });
    const b = tx({
      id: "b",
      reference_id: "s2",
      reference_number: null,
      status: "pending",
      due_date: "2026-07-01",
    });
    const rows = [a, b];
    const groups = groupByReference(rows);

    expect(deriveGroupStatus(b, groups)).toBe("overdue");
  });

  it("continua funcionando pelo reference_id quando reference_number está ausente", () => {
    const a = tx({ id: "a", reference_id: "s1", reference_number: null, status: "paid" });
    const b = tx({ id: "b", reference_id: "s1", reference_number: null, status: "pending" });
    const rows = [a, b];
    const groups = groupByReference(rows);

    expect(deriveGroupStatus(b, groups)).toBe("partial");
  });
});
