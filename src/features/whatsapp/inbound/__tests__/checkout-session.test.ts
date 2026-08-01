/**
 * Sprint 6.8 — Etapa 1: fechamento conversacional (somente memória).
 * Nenhuma venda, orçamento, estoque, financeiro ou CRM é tocado.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  CHECKOUT_ABORTED_MESSAGE,
  CHECKOUT_SESSION_TTL_MS,
  EMPTY_CART_MESSAGE,
  PROMPTS,
  SUMMARY_CONFIRM_MESSAGE,
  advanceCheckout,
  createCheckoutSession,
  formatCheckoutSummary,
  isCheckoutIntent,
  isCheckoutSessionExpired,
  parseFulfillment,
  parsePayment,
} from "../checkout-session";
import {
  handleCheckoutTurn,
  peekCheckoutSession,
  resetCheckoutSessions,
  saveCheckoutSession,
} from "../checkout-session.server";
import { addProduct, createCartSession, type CartSession } from "../cart-session";
import { resetCartSessions, getCartSession, saveCartSession } from "../cart-session.server";

function cartWith(...names: Array<[string, number, number]>): CartSession {
  let cart = createCartSession("co", "5511", 1000);
  for (const [name, price, qty] of names) {
    cart = addProduct(
      cart,
      { id: name, name, price, brand: null, categoryId: null, unit: "un" },
      qty,
      1000,
    );
  }
  return cart;
}

describe("isCheckoutIntent", () => {
  it.each([
    "quero finalizar",
    "fechar pedido",
    "concluir compra",
    "pode finalizar",
    "vamos fechar",
    "continuar",
    "quero comprar",
    "fechar",
  ])("reconhece '%s'", (t) => {
    expect(isCheckoutIntent(t)).toBe(true);
  });

  it("ignora conversa comum", () => {
    expect(isCheckoutIntent("bom dia")).toBe(false);
    expect(isCheckoutIntent("")).toBe(false);
  });
});

describe("parsers", () => {
  it("entende retirada e entrega", () => {
    expect(parseFulfillment("retirar na loja")).toBe("pickup");
    expect(parseFulfillment("1")).toBe("pickup");
    expect(parseFulfillment("quero entrega")).toBe("delivery");
    expect(parseFulfillment("2")).toBe("delivery");
    expect(parseFulfillment("talvez")).toBeNull();
  });

  it("entende as formas de pagamento", () => {
    expect(parsePayment("pix")).toBe("pix");
    expect(parsePayment("cartão de crédito")).toBe("card");
    expect(parsePayment("dinheiro")).toBe("cash");
    expect(parsePayment("boleto")).toBeNull();
  });
});

describe("advanceCheckout — retirada", () => {
  it("percorre nome → retirada → pagamento → resumo", () => {
    const cart = cartWith(["Bolsa", 200, 1]);
    let s = createCheckoutSession("co", "5511", 1000);
    expect(s.step).toBe("buyer_name");

    let r = advanceCheckout({ session: s, cart, text: "Maria Silva", now: 1001 });
    expect(r.session.buyerName).toBe("Maria Silva");
    expect(r.text).toBe(PROMPTS.fulfillment);

    r = advanceCheckout({ session: r.session, cart, text: "retirar na loja", now: 1002 });
    expect(r.session.fulfillment).toBe("pickup");
    expect(r.text).toBe(PROMPTS.payment);

    r = advanceCheckout({ session: r.session, cart, text: "pix", now: 1003 });
    expect(r.session.step).toBe("summary");
    expect(r.text).toContain("🏪 Retirada na loja");
    expect(r.text).toContain("PIX");
    expect(r.text).toContain(SUMMARY_CONFIRM_MESSAGE);
    s = r.session;
    expect(s.payment).toBe("pix");
  });

  it("repete a pergunta quando a resposta é inválida", () => {
    const cart = cartWith(["Bolsa", 200, 1]);
    const s = { ...createCheckoutSession("co", "5511", 1000), step: "fulfillment" as const };
    const r = advanceCheckout({ session: s, cart, text: "sei lá", now: 1001 });
    expect(r.session.step).toBe("fulfillment");
    expect(r.text).toBe(PROMPTS.fulfillment);
  });
});

describe("advanceCheckout — entrega e endereço", () => {
  it("coleta cidade, bairro, endereço e complemento", () => {
    const cart = cartWith(["Bolsa", 200, 1]);
    let r = advanceCheckout({
      session: createCheckoutSession("co", "5511", 1000),
      cart,
      text: "João",
      now: 1001,
    });
    r = advanceCheckout({ session: r.session, cart, text: "entrega", now: 1002 });
    expect(r.text).toBe(PROMPTS.delivery_city);
    r = advanceCheckout({ session: r.session, cart, text: "Recife", now: 1003 });
    expect(r.text).toBe(PROMPTS.delivery_neighborhood);
    r = advanceCheckout({ session: r.session, cart, text: "Boa Viagem", now: 1004 });
    expect(r.text).toBe(PROMPTS.delivery_address);
    r = advanceCheckout({ session: r.session, cart, text: "Rua A, 100", now: 1005 });
    expect(r.text).toBe(PROMPTS.delivery_complement);
    r = advanceCheckout({ session: r.session, cart, text: "Apto 202", now: 1006 });
    expect(r.session.delivery).toEqual({
      city: "Recife",
      neighborhood: "Boa Viagem",
      address: "Rua A, 100",
      complement: "Apto 202",
    });
    expect(r.text).toBe(PROMPTS.payment);
  });

  it("permite pular o complemento", () => {
    const cart = cartWith(["Bolsa", 200, 1]);
    const s = {
      ...createCheckoutSession("co", "5511", 1000),
      step: "delivery_complement" as const,
      fulfillment: "delivery" as const,
    };
    const r = advanceCheckout({ session: s, cart, text: "não", now: 1001 });
    expect(r.session.delivery.complement).toBeNull();
    expect(r.text).toBe(PROMPTS.payment);
  });
});

describe("formatCheckoutSummary", () => {
  it("lista itens, entrega, pagamento e total", () => {
    const cart = cartWith(["Bolsa", 200, 2], ["Carteira", 89.9, 1]);
    const s = {
      ...createCheckoutSession("co", "5511", 1000),
      buyerName: "Maria",
      fulfillment: "delivery" as const,
      delivery: {
        city: "Recife",
        neighborhood: "Boa Viagem",
        address: "Rua A, 100",
        complement: null,
      },
      payment: "card" as const,
      step: "summary" as const,
    };
    const text = formatCheckoutSummary(s, cart);
    expect(text).toContain("🛍️ *Resumo do Pedido*");
    expect(text).toContain("2x Bolsa");
    expect(text).toContain("Carteira");
    expect(text).toContain("Rua A, 100, Boa Viagem, Recife");
    expect(text).toContain("Cartão");
    expect(text).toContain("489,90");
    expect(text.endsWith(SUMMARY_CONFIRM_MESSAGE)).toBe(true);
  });
});

describe("expiração", () => {
  it("considera expirada após o TTL", () => {
    const s = createCheckoutSession("co", "5511", 0);
    expect(isCheckoutSessionExpired(s, CHECKOUT_SESSION_TTL_MS + 1)).toBe(true);
    expect(isCheckoutSessionExpired(s, 1000)).toBe(false);
    expect(isCheckoutSessionExpired(null)).toBe(true);
  });
});

describe("handleCheckoutTurn", () => {
  beforeEach(() => {
    resetCheckoutSessions();
    resetCartSessions();
  });

  function fillCart(now = Date.now()) {
    const session = getCartSession("co", "5511", now);
    saveCartSession(
      addProduct(
        session,
        { id: "p1", name: "Bolsa", price: 200, brand: null, categoryId: null, unit: "un" },
        1,
        now,
      ),
    );
  }

  it("ignora mensagens fora do fluxo", () => {
    expect(
      handleCheckoutTurn({ companyId: "co", phone: "5511", text: "bom dia" }),
    ).toBeNull();
  });

  it("avisa quando o carrinho está vazio", () => {
    const out = handleCheckoutTurn({ companyId: "co", phone: "5511", text: "fechar pedido" });
    expect(out?.text).toBe(EMPTY_CART_MESSAGE);
    expect(peekCheckoutSession("co", "5511")).toBeNull();
  });

  it("executa o fluxo completo com retirada", () => {
    fillCart();
    expect(
      handleCheckoutTurn({ companyId: "co", phone: "5511", text: "quero finalizar" })?.text,
    ).toBe(PROMPTS.buyer_name);
    expect(handleCheckoutTurn({ companyId: "co", phone: "5511", text: "Maria" })?.text).toBe(
      PROMPTS.fulfillment,
    );
    expect(handleCheckoutTurn({ companyId: "co", phone: "5511", text: "retirar" })?.text).toBe(
      PROMPTS.payment,
    );
    const summary = handleCheckoutTurn({ companyId: "co", phone: "5511", text: "dinheiro" });
    expect(summary?.step).toBe("summary");
    expect(summary?.text).toContain("Dinheiro");
    expect(summary?.text).toContain("200,00");
  });

  it("abandona o fluxo mantendo o carrinho", () => {
    fillCart();
    handleCheckoutTurn({ companyId: "co", phone: "5511", text: "fechar" });
    const out = handleCheckoutTurn({ companyId: "co", phone: "5511", text: "cancelar" });
    expect(out?.text).toBe(CHECKOUT_ABORTED_MESSAGE);
    expect(peekCheckoutSession("co", "5511")).toBeNull();
    expect(getCartSession("co", "5511").items).toHaveLength(1);
  });

  it("reinicia o checkout quando pedido", () => {
    fillCart();
    handleCheckoutTurn({ companyId: "co", phone: "5511", text: "fechar" });
    handleCheckoutTurn({ companyId: "co", phone: "5511", text: "Maria" });
    const out = handleCheckoutTurn({ companyId: "co", phone: "5511", text: "recomeçar" });
    expect(out?.text).toBe(PROMPTS.buyer_name);
    expect(peekCheckoutSession("co", "5511")?.buyerName).toBeNull();
  });

  it("descarta a sessão expirada e recomeça do zero", () => {
    const t0 = 1_000_000;
    fillCart(t0);
    saveCheckoutSession({
      ...createCheckoutSession("co", "5511", t0),
      step: "payment",
      buyerName: "Maria",
    });
    const later = t0 + CHECKOUT_SESSION_TTL_MS + 1;
    saveCartSession({ ...getCartSession("co", "5511", t0), updatedAt: later });
    const out = handleCheckoutTurn({
      companyId: "co",
      phone: "5511",
      text: "quero finalizar",
      now: later,
    });
    expect(out?.step).toBe("buyer_name");
  });
});
