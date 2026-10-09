import { describe, expect, it } from "vitest";
import { describeChanges, describeEntry, formatAuditValue } from "../describe";

describe("histórico de alterações — textos", () => {
  it("monta a frase de quem fez o quê", () => {
    expect(
      describeEntry({
        action: "update",
        table_name: "financial_transactions",
        label: "shoope",
        actor_name: "Gabriela",
        via: "app",
      }),
    ).toBe("Gabriela alterou lançamento “shoope”");
    expect(
      describeEntry({
        action: "insert",
        table_name: "sales",
        label: null,
        actor_name: null,
        via: "servidor",
      }),
    ).toBe("Sistema (Bella/WhatsApp/automação) criou venda");
  });

  it("mostra antes → depois, com dinheiro e situação em português", () => {
    const lines = describeChanges({
      action: "update",
      changes: {
        description: { old: "Duplo", new: "Duplo editado" },
        amount: { old: 30, new: 31 },
        status: { old: "pending", new: "paid" },
        updated_at: { old: "x", new: "y" },
      },
    });
    expect(lines.map((l) => l.field)).toEqual(["status", "amount", "description"]);
    expect(lines[0]).toMatchObject({ label: "Situação", before: "pendente", after: "pago" });
    expect(lines[1].after).toContain("31,00");
  });

  it("esconde ids técnicos no retrato de criação", () => {
    const lines = describeChanges({
      action: "insert",
      changes: {
        id: "aa3c8ef7-849f-464a-baff-2bcfe8ae291c",
        company_id: "x",
        amount: 5,
        type: "expense",
      },
    });
    expect(lines.map((l) => l.field).sort()).toEqual(["amount", "type"]);
    expect(formatAuditValue("due_date", "2026-10-10")).toBe("10/10/2026");
  });
});
