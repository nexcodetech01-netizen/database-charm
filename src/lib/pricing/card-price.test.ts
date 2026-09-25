import { describe, expect, it } from "vitest";
import { calcParcela, calcPrecoCartao, DEFAULT_CARD_PRICE_CONFIG } from "./card-price";

describe("preço no cartão", () => {
  it("repassa a taxa e arredonda para cima", () => {
    expect(calcPrecoCartao(100, DEFAULT_CARD_PRICE_CONFIG)).toBe(102.97);
  });

  it("arredonda a parcela para cima sem alterar o total", () => {
    expect(calcParcela(102.97, 3)).toBe(34.33);
  });

  it("mantém o preço à vista quando a configuração está inativa", () => {
    expect(calcPrecoCartao(100, { ...DEFAULT_CARD_PRICE_CONFIG, active: false })).toBe(100);
  });
});