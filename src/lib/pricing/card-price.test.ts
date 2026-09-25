import { describe, expect, it } from "vitest";
import {
  calcParcela,
  calcPrecoCartao,
  calcTotalAvistaPdv,
  calcTotalCartaoPdv,
  DEFAULT_CARD_PRICE_CONFIG,
} from "./card-price";

describe("preço no cartão", () => {
  it("repassa a taxa e arredonda para cima", () => {
    expect(calcPrecoCartao(100, DEFAULT_CARD_PRICE_CONFIG)).toBe(102.97);
  });

  it("arredonda a parcela para cima sem alterar o total", () => {
    expect(calcParcela(102.97, 3)).toBe(34.33);
  });

  it("não soma um centavo nos valores exatos do banco", () => {
    expect(calcPrecoCartao(48.56)).toBe(50);
    expect(calcPrecoCartao(97.12)).toBe(100);
    expect(calcParcela(50, 3)).toBe(16.67);
  });

  it("coincide com a fórmula inteira para cada centavo de R$ 0,01 a R$ 1.000,00", () => {
    const feeBasisPoints = Math.round(DEFAULT_CARD_PRICE_CONFIG.cardFeePercent * 100);
    for (let cashCents = 1; cashCents <= 100000; cashCents++) {
      const expectedCents = Math.floor(
        (cashCents * 10000 + (10000 - feeBasisPoints) - 1) / (10000 - feeBasisPoints),
      );
      expect(calcPrecoCartao(cashCents / 100)).toBe(expectedCents / 100);
    }
  });

  it("mantém o preço à vista quando a configuração está inativa", () => {
    expect(calcPrecoCartao(100, { ...DEFAULT_CARD_PRICE_CONFIG, active: false })).toBe(100);
  });

  describe("total do PDV no cartão", () => {
    it("calcula R$ 51,48 e três parcelas de R$ 17,16 para um item de R$ 49,99", () => {
      const total = calcTotalCartaoPdv(
        [{ unit_price: 49.99, quantity: 1, discount: 0 }],
        0,
        0,
        DEFAULT_CARD_PRICE_CONFIG,
      );

      expect(total).toBe(51.48);
      expect(calcParcela(total, 3)).toBe(17.16);
    });

    it("calcula R$ 102,97 para um item de R$ 100,00", () => {
      expect(calcTotalCartaoPdv(
        [{ unit_price: 100, quantity: 1, discount: 0 }],
        0,
        0,
        DEFAULT_CARD_PRICE_CONFIG,
      )).toBe(102.97);
    });

    it("usa o preço efetivo alterado no carrinho", () => {
      expect(calcTotalCartaoPdv(
        [{ unit_price: 80, quantity: 2, discount: 0 }],
        0,
        0,
        DEFAULT_CARD_PRICE_CONFIG,
      )).toBe(164.76);
    });

    it("subtrai o desconto geral depois de reprecificar os itens", () => {
      expect(calcTotalCartaoPdv(
        [{ unit_price: 100, quantity: 1, discount: 0 }],
        10,
        0,
        DEFAULT_CARD_PRICE_CONFIG,
      )).toBe(92.97);
    });

    it("subtrai o desconto do item em cada linha como a função SQL", () => {
      const items = [{ unit_price: 100, quantity: 1, discount: 10 }];

      expect(calcTotalAvistaPdv(items, 0, 0)).toBe(90);
      expect(calcTotalCartaoPdv(items, 0, 0, DEFAULT_CARD_PRICE_CONFIG)).toBe(92.97);
    });
  });
});