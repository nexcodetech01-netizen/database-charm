import { describe, expect, it } from "vitest";
import { generatePixBRCode } from "./pix-brcode";

describe("generatePixBRCode", () => {
  it("gera payload EMV com CRC válido de 4 chars", () => {
    const payload = generatePixBRCode({
      pixKey: "test@nexos.com",
      recipientName: "Loja NexOS",
      recipientCity: "São Paulo",
      amount: 12.34,
    });
    // Payload termina com "6304" + 4 chars hex
    expect(payload).toMatch(/6304[0-9A-F]{4}$/);
    expect(payload).toContain("br.gov.bcb.pix");
    expect(payload).toContain("540512.34"); // tag 54, len 05, valor "12.34"
    expect(payload).toContain("5303986"); // moeda BRL
    expect(payload).toContain("5802BR");
  });

  it("normaliza acentos do recebedor e cidade", () => {
    const payload = generatePixBRCode({
      pixKey: "x",
      recipientName: "João Ação",
      recipientCity: "São Paulo",
      amount: 1,
    });
    expect(payload).toContain("JOAO ACAO");
    expect(payload).toContain("SAO PAULO");
  });

  it("omite valor quando amount inválido (PIX de valor livre)", () => {
    const payload = generatePixBRCode({
      pixKey: "x",
      recipientName: "R",
      recipientCity: "C",
      amount: 0,
    });
    expect(payload).not.toMatch(/540[0-9]/);
  });

  it("exige chave PIX", () => {
    expect(() =>
      generatePixBRCode({
        pixKey: "",
        recipientName: "R",
        recipientCity: "C",
        amount: 1,
      }),
    ).toThrow();
  });
});
