import { describe, expect, it } from "vitest";
import { buildReceiptText, type ReceiptTextInput } from "../whatsapp-receipt";

const base: ReceiptTextInput = {
  brandName: "T&G Bolsas e Acessórios",
  saleNumber: "PDV-20261011-210025",
  date: "2026-10-10",
  time: "2026-10-11T00:02:00Z",
  customerName: "Ana Vitória",
  items: [
    { quantity: 1, description: "S11 Pro", unitPrice: 179.9, total: 179.9 },
    { quantity: 1, description: "S10", unitPrice: 139.9, total: 139.9 },
  ],
  subtotal: 319.8,
  discount: 0,
  total: 319.8,
  saleStatus: "partially_paid",
  paymentMethod: "credit",
  hasSettlement: false,
  credit: null,
};

describe("cupom do WhatsApp", () => {
  it("crediário mostra entrada, saldo e parcelas (igual ao impresso)", () => {
    const t = buildReceiptText({
      ...base,
      credit: {
        downPayment: 100,
        downPaymentMethod: "cash",
        balance: 219.8,
        installments: [{ sequence: 1, amount: 219.8, paid: 0, dueDate: "2026-11-10" }],
      },
    });
    expect(t).toContain("*Pagamento:* Crediário");
    expect(t).toContain("Entrada (Dinheiro): R$");
    expect(t).toContain("100,00");
    expect(t).toContain("Saldo a pagar: R$");
    expect(t).toContain("219,80");
    expect(t).toContain("1ª parcela");
    expect(t).toContain("vence 10/11/2026");
    expect(t).not.toContain("Pagamento pendente");
  });

  it("não usa emojis (WhatsApp de computador troca por �)", () => {
    const t = buildReceiptText(base);
    expect(/\p{Extended_Pictographic}/u.test(t)).toBe(false);
  });

  it("venda comum: forma de pagamento em português e situação", () => {
    const t = buildReceiptText({ ...base, saleStatus: "paid", paymentMethod: "pix" });
    expect(t).toContain("*Pagamento:* Pix");
    expect(t).toContain("*Status:* Pago");
  });
});

describe("data do cupom", () => {
  it("data da venda (só dia) não volta um dia no fuso do Brasil", () => {
    const t = buildReceiptText({ ...base, date: "2026-10-11" });
    expect(t).toContain("*Data:* 11/10/2026");
  });
});
