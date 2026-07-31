/**
 * Testes de regressão da Política de Descontos do PDV.
 *
 * Cobrem:
 *  - Desconto R$ 0,00 nunca dispara bloqueio/aviso (independente do método).
 *  - PIX (Bella Pay) e PIX Próprio (`pix_manual`) permitem desconto por
 *    serem à vista via atributo `kind`, não pelo rótulo.
 *  - Dinheiro e Débito (também "cash") permitem desconto.
 *  - Crédito parcelado e outras formas não configuradas em `allowedMethods`
 *    continuam bloqueados quando desconto > 0.
 *  - Excesso ao percentual máximo mantém o enforcement configurado.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_DISCOUNT_POLICY,
  evaluateDiscount,
  type DiscountPolicy,
} from "../discount-policy";

const basePolicy: DiscountPolicy = { ...DEFAULT_DISCOUNT_POLICY };

describe("evaluateDiscount — desconto zero", () => {
  it.each([
    "pix",
    "pix_manual",
    "cash",
    "debit_card",
    "credit_card",
    "boleto",
    "payment_link",
    "",
  ])("nunca bloqueia quando desconto = 0 (método: %s)", (method) => {
    const r = evaluateDiscount({
      subtotal: 500,
      discountValue: 0,
      paymentMethod: method,
      policy: basePolicy,
    });
    expect(r.kind).toBe("no_discount");
  });

  it("trata desconto negativo como no_discount", () => {
    const r = evaluateDiscount({
      subtotal: 500,
      discountValue: -10,
      paymentMethod: "credit_card",
      policy: basePolicy,
    });
    expect(r.kind).toBe("no_discount");
  });
});

describe("evaluateDiscount — PIX à vista (todas modalidades)", () => {
  it("permite desconto em PIX (Bella Pay)", () => {
    const r = evaluateDiscount({
      subtotal: 1000,
      discountValue: 30,
      paymentMethod: "pix",
      policy: basePolicy,
    });
    expect(r.kind).toBe("ok");
  });

  it("permite desconto em PIX Próprio (pix_manual) mesmo fora do allowedMethods", () => {
    const policy: DiscountPolicy = { ...basePolicy, allowedMethods: ["pix"] };
    const r = evaluateDiscount({
      subtotal: 1000,
      discountValue: 30,
      paymentMethod: "pix_manual",
      policy,
    });
    // pix_manual é "cash" via registro → não deve cair no bloqueio por método.
    expect(r.kind).toBe("ok");
  });

  it("permite desconto em Dinheiro e Débito (kind=cash)", () => {
    for (const method of ["cash", "debit_card"]) {
      const r = evaluateDiscount({
        subtotal: 1000,
        discountValue: 20,
        paymentMethod: method,
        policy: basePolicy,
      });
      expect(r.kind, `método ${method}`).toBe("ok");
    }
  });
});

describe("evaluateDiscount — métodos deferidos", () => {
  it("bloqueia desconto em Crédito parcelado (deferred, fora do allowedMethods)", () => {
    const r = evaluateDiscount({
      subtotal: 1000,
      discountValue: 30,
      paymentMethod: "credit_card",
      policy: basePolicy,
    });
    expect(r.kind).toBe("disabled_by_method");
  });

  it("bloqueia Boleto e Link de pagamento por padrão", () => {
    for (const method of ["boleto", "payment_link"]) {
      const r = evaluateDiscount({
        subtotal: 500,
        discountValue: 10,
        paymentMethod: method,
        policy: basePolicy,
      });
      expect(r.kind, `método ${method}`).toBe("disabled_by_method");
    }
  });

  it("permite Crédito quando explicitamente incluído em allowedMethods", () => {
    const policy: DiscountPolicy = {
      ...basePolicy,
      allowedMethods: ["pix", "cash", "credit_card"],
    };
    const r = evaluateDiscount({
      subtotal: 1000,
      discountValue: 30,
      paymentMethod: "credit_card",
      policy,
    });
    expect(r.kind).toBe("ok");
  });
});

describe("evaluateDiscount — limites e política", () => {
  it("retorna 'exceeds' com enforcement quando ultrapassa maxPercent", () => {
    const r = evaluateDiscount({
      subtotal: 1000,
      discountValue: 200, // 20% > 5%
      paymentMethod: "pix",
      policy: basePolicy,
    });
    expect(r.kind).toBe("exceeds");
    if (r.kind === "exceeds") {
      expect(r.enforcement).toBe(basePolicy.enforcement);
      expect(r.percent).toBeCloseTo(20);
    }
  });

  it("respeita overrideApproved e libera acima do limite", () => {
    const r = evaluateDiscount({
      subtotal: 1000,
      discountValue: 200,
      paymentMethod: "pix",
      policy: basePolicy,
      overrideApproved: true,
    });
    expect(r.kind).toBe("ok");
  });

  it("retorna 'disabled_by_policy' quando policy.enabled = false", () => {
    const r = evaluateDiscount({
      subtotal: 1000,
      discountValue: 30,
      paymentMethod: "pix",
      policy: { ...basePolicy, enabled: false },
    });
    expect(r.kind).toBe("disabled_by_policy");
  });
});
