import { describe, expect, it } from "vitest";
import { formatCurrency } from "@/lib/format";
import {
  buildLinkMessage,
  buildPixMessage,
  onlyDigits,
  toWhatsAppNumber,
} from "./checkout-messages";

describe("onlyDigits", () => {
  it("remove tudo que não é dígito", () => {
    expect(onlyDigits("(14) 99876-5432")).toBe("14998765432");
    expect(onlyDigits(null)).toBe("");
  });
});

describe("toWhatsAppNumber", () => {
  it("prepende 55 em números com DDD", () => {
    expect(toWhatsAppNumber("(14) 99876-5432")).toBe("5514998765432");
    expect(toWhatsAppNumber("1434561234")).toBe("551434561234");
  });

  it("mantém números que já têm DDI", () => {
    expect(toWhatsAppNumber("+55 14 99876-5432")).toBe("5514998765432");
  });

  it("rejeita vazio ou curto demais", () => {
    expect(toWhatsAppNumber("")).toBeNull();
    expect(toWhatsAppNumber("98765")).toBeNull();
  });
});

describe("mensagens de cobrança", () => {
  it("PIX usa fallbacks quando não há nomes", () => {
    const msg = buildPixMessage({ amount: 50, pixPayload: "000201XYZ" });
    expect(msg).toContain("Olá, cliente!");
    expect(msg).toContain("Segue sua cobrança da nossa loja.");
    expect(msg).toContain(formatCurrency(50));
    expect(msg).toContain("000201XYZ");
  });

  it("link inclui nome do cliente e URL", () => {
    const msg = buildLinkMessage({
      customerName: "  Ana ",
      amount: 120,
      paymentLink: "https://pay.example/abc",
    });
    expect(msg.startsWith("Olá, Ana!")).toBe(true);
    expect(msg).toContain("https://pay.example/abc");
  });
});
