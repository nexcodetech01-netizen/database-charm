import { describe, expect, it } from "vitest";
import { buildReceiptHtml, buildReceiptRows, buildReceiptWhatsappText, type PaymentReceiptData } from "./payment-receipt";

const base: PaymentReceiptData = {
  storeName: "T&G Bolsas",
  customerName: "Fabia",
  saleNumber: "PDV-1",
  paidAt: "2026-10-08T19:30:00Z",
  receivedAmount: 40,
  paymentMethod: "pix",
  saleTotal: 40,
  totalPaid: 40,
  remaining: 0,
  nextInstallments: [],
};
const n = (s: string) => s.replace(/\s/g, " ");

describe("comprovante de pagamento", () => {
  it("venda quitada", () => {
    const { rows, installments } = buildReceiptRows(base);
    expect(rows.find((r) => r[0] === "Situação")?.[1]).toBe("QUITADO");
    expect(installments).toEqual([]);
    expect(n(buildReceiptWhatsappText(base))).toContain("Situação: *QUITADO*");
  });

  it("crediário com saldo mostra o que falta e as próximas parcelas", () => {
    const data = {
      ...base,
      receivedAmount: 50,
      saleTotal: 150,
      totalPaid: 50,
      remaining: 100,
      nextInstallments: [
        { sequence: 2, dueDate: "2026-11-10", amount: 50 },
        { sequence: 3, dueDate: "2026-12-10", amount: 50 },
      ],
    };
    const text = n(buildReceiptWhatsappText(data));
    expect(text).toContain("Falta pagar: *R$ 100,00*");
    expect(text).toContain("• 2ª parcela – 10/11/2026 – R$ 50,00");
    expect(buildReceiptRows(data).installments).toHaveLength(2);
  });

  it("HTML do cupom escapa texto e respeita a largura", () => {
    const html = buildReceiptHtml({ ...base, customerName: "<b>x</b>" }, "58mm");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).toContain("size: 58mm auto");
  });
});
