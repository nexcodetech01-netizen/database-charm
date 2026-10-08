import { describe, expect, it } from "vitest";
import { receivableView } from "./receivable-state";

const base = { grandTotal: 100, paymentMethod: null, remaining: null, nextDue: null, isCredit: false };
const today = "2026-10-08";
const t = (s: string) => s.replace(/\s/g, " ");

describe("receivableView", () => {
  it("paga, cancelada e rascunho", () => {
    expect(receivableView({ ...base, status: "paid" }, today)).toEqual({ badge: "paid", detail: null });
    expect(receivableView({ ...base, status: "cancelled" }, today).badge).toBe("cancelled");
    expect(receivableView({ ...base, status: "draft" }, today).badge).toBe("draft");
  });

  it("crediário em dia", () => {
    const v = receivableView(
      { ...base, status: "pending", grandTotal: 139.89, remaining: 139.89, isCredit: true, paymentMethod: "credit", nextDue: "2026-10-23" },
      today,
    );
    expect(v.badge).toBe("receivable");
    expect(t(v.detail!)).toBe("crediário · vence 23/10 · falta R$ 139,89");
  });

  it("parcial: mostra quanto pagou e quanto falta", () => {
    const v = receivableView(
      { ...base, status: "partially_paid", grandTotal: 507.39, remaining: 157.39, isCredit: true, paymentMethod: "credit" },
      today,
    );
    expect(t(v.detail!)).toBe("crediário · pago R$ 350,00 · falta R$ 157,39");
  });

  it("vencido quando a data passou", () => {
    const v = receivableView(
      { ...base, status: "pending", grandTotal: 66.53, remaining: 66.53, isCredit: true, paymentMethod: "credit", nextDue: "2026-09-07" },
      today,
    );
    expect(v.badge).toBe("overdue");
    expect(t(v.detail!)).toContain("venceu 07/09");
  });

  it("sem forma de pagamento", () => {
    const v = receivableView({ ...base, status: "pending", grandTotal: 40, remaining: 40 }, today);
    expect(t(v.detail!)).toBe("sem forma de pagamento · falta R$ 40,00");
  });
});
