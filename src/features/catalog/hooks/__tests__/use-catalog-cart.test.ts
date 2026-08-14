import { describe, it, expect } from "vitest";
import { buildCartWhatsAppMessage } from "../use-catalog-cart";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

describe("buildCartWhatsAppMessage", () => {
  it("junta vários produtos numa mensagem só, com quantidade e total", () => {
    const message = buildCartWhatsAppMessage(
      [
        { productId: "p1", name: "Capinha A15", price: 15, reference: "CAP-A15", quantity: 3 },
        { productId: "p2", name: "Película Privacidade", price: 12, reference: "PEL-PRIV", quantity: 2 },
      ],
      "https://nexos.exemplo.com.br/catalogo/colecao/promo",
      fmt,
    );

    expect(message).toContain("3x Capinha A15");
    expect(message).toContain("2x Película Privacidade");
    // 3*15 + 2*12 = 45 + 24 = 69
    expect(message).toContain(fmt(69));
    expect(message).toContain("https://nexos.exemplo.com.br/catalogo/colecao/promo");
  });

  it("inclui a referência do produto entre parênteses quando existe", () => {
    const message = buildCartWhatsAppMessage(
      [{ productId: "p1", name: "Bolsa Quadrada", price: 80, reference: "QUA-PRE-001", quantity: 1 }],
      "https://x.com",
      fmt,
    );
    expect(message).toContain("(QUA-PRE-001)");
  });

  it("omite os parênteses quando não há referência", () => {
    const message = buildCartWhatsAppMessage(
      [{ productId: "p1", name: "Item sem SKU legível", price: 10, reference: "", quantity: 1 }],
      "https://x.com",
      fmt,
    );
    expect(message).not.toContain("()");
  });
});
