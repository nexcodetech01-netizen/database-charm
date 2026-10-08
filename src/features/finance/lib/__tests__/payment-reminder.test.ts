import { describe, expect, it } from "vitest";
import { buildPaymentReminder, paymentReminderLink } from "../payment-reminder";

describe("lembrete de pagamento", () => {
  const base = { customerName: "ELZA maria", storeName: "T&G", pixKey: "tg@pix.com", amount: 154.87, due: "2026-10-10" };

  it("cobra quem venceu, com data e Pix", () => {
    const t = buildPaymentReminder({ ...base, daysLate: 3 });
    expect(t).toContain("Oi, Elza!");
    expect(t).toContain("venceu em 10/10");
    expect(t).toContain("Chave Pix: tg@pix.com");
    expect(t).toContain("na T&G");
  });

  it("avisa quem vence hoje ou em breve", () => {
    expect(buildPaymentReminder({ ...base, daysLate: 0 })).toContain("vence hoje (10/10)");
    expect(buildPaymentReminder({ ...base, daysLate: -2, pixKey: null })).toContain("vence em 10/10");
    expect(buildPaymentReminder({ ...base, daysLate: -2, pixKey: null })).not.toContain("Pix");
  });

  it("monta o link só com telefone válido", () => {
    expect(paymentReminderLink("(14) 99999-0000", "oi")).toBe("https://wa.me/5514999990000?text=oi");
    expect(paymentReminderLink(null, "oi")).toBeNull();
    expect(paymentReminderLink("123", "oi")).toBeNull();
  });
});
