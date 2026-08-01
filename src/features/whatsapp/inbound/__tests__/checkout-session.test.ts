/**
 * Sprint 6.8 — Etapas 1 e 3: fechamento conversacional + dados do cliente.
 * Somente memória: nenhuma venda, orçamento, cliente, estoque, financeiro
 * ou CRM é criado/alterado por estes fluxos.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CEP_NOT_FOUND_MESSAGE,
  CHECKOUT_ABORTED_MESSAGE,
  CHECKOUT_SESSION_TTL_MS,
  CNPJ_PROMPT,
  EMPTY_CART_MESSAGE,
  INVALID_BIRTH_DATE_MESSAGE,
  INVALID_CEP_MESSAGE,
  INVALID_CNPJ_MESSAGE,
  INVALID_CPF_MESSAGE,
  PROMPTS,
  SUMMARY_CONFIRM_MESSAGE,
  advanceCheckout,
  createCheckoutSession,
  formatCheckoutSummary,
  isCheckoutIntent,
  isCheckoutSessionExpired,
  parseBirthDate,
  parseFulfillment,
  parsePayment,
  parsePersonType,
  parseZipCode,
  type CepResolver,
  type CheckoutSession,
} from "../checkout-session";
import {
  handleCheckoutTurn,
  peekCheckoutSession,
  resetCheckoutSessions,
  saveCheckoutSession,
} from "../checkout-session.server";
import { addProduct, createCartSession, type CartSession } from "../cart-session";
import { resetCartSessions, getCartSession, saveCartSession } from "../cart-session.server";

const VALID_CPF = "52998224725";
const VALID_CNPJ = "11222333000181";

const resolveCep: CepResolver = vi.fn(async (cep: string) =>
  cep === "50000000"
    ? {
        street: "Rua A",
        neighborhood: "Boa Viagem",
        city: "Recife",
        state: "PE",
      }
    : null,
);

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

/** Percorre o fluxo respondendo as mensagens em sequência. */
async function run(
  cart: CartSession,
  answers: string[],
  session: CheckoutSession = createCheckoutSession("co", "5511", 1000),
) {
  let r = { session, text: "", aborted: false };
  let t = 1000;
  for (const text of answers) {
    t += 1;
    r = await advanceCheckout({ session: r.session, cart, text, now: t, resolveCep });
  }
  return r;
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
    expect(parseFulfillment("retirada")).toBe("pickup");
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

  it("entende pessoa física e jurídica", () => {
    expect(parsePersonType("pessoa física")).toBe("pf");
    expect(parsePersonType("1")).toBe("pf");
    expect(parsePersonType("pj")).toBe("pj");
    expect(parsePersonType("pessoa jurídica")).toBe("pj");
    expect(parsePersonType("2")).toBe("pj");
    expect(parsePersonType("sei lá")).toBeNull();
  });

  it("valida o formato do CEP", () => {
    expect(parseZipCode("50000-000")).toBe("50000000");
    expect(parseZipCode("50000000")).toBe("50000000");
    expect(parseZipCode("500")).toBeNull();
    expect(parseZipCode("abc")).toBeNull();
  });

  it("valida a data de nascimento DD/MM/AAAA", () => {
    expect(parseBirthDate("05/03/1990")).toBe("1990-03-05");
    expect(parseBirthDate("31/02/1990")).toBeNull();
    expect(parseBirthDate("1990-03-05")).toBeNull();
    expect(parseBirthDate("5/3/90")).toBeNull();
  });
});

describe("advanceCheckout — pessoa física", () => {
  it("coleta nome, CPF, CEP, número, nascimento, entrega e pagamento", async () => {
    const cart = cartWith(["Bolsa", 200, 1]);
    const r = await run(cart, [
      "Maria Silva",
      "pessoa física",
      VALID_CPF,
      "50000-000",
      "100",
      "Apto 202",
      "05/03/1990",
      "entrega",
      "pix",
    ]);
    const c = r.session.customer;
    expect(c.fullName).toBe("Maria Silva");
    expect(c.personType).toBe("pf");
    expect(c.cpf).toBe(VALID_CPF);
    expect(c.zipCode).toBe("50000000");
    expect(c.state).toBe("PE");
    expect(c.city).toBe("Recife");
    expect(c.district).toBe("Boa Viagem");
    expect(c.street).toBe("Rua A");
    expect(c.number).toBe("100");
    expect(c.complement).toBe("Apto 202");
    expect(c.birthDate).toBe("1990-03-05");
    expect(r.session.step).toBe("summary");
    expect(r.text).toContain(SUMMARY_CONFIRM_MESSAGE);
  });

  it("rejeita CPF inválido e pede novamente", async () => {
    const cart = cartWith(["Bolsa", 200, 1]);
    const r = await run(cart, ["Maria", "pf", "11111111111"]);
    expect(r.text).toBe(INVALID_CPF_MESSAGE);
    expect(r.session.step).toBe("document");
    const ok = await advanceCheckout({
      session: r.session,
      cart,
      text: VALID_CPF,
      now: 2000,
      resolveCep,
    });
    expect(ok.session.customer.cpf).toBe(VALID_CPF);
    expect(ok.text).toBe(PROMPTS.zip_code);
  });

  it("exige nascimento em formato válido", async () => {
    const cart = cartWith(["Bolsa", 200, 1]);
    const r = await run(cart, [
      "Maria",
      "pf",
      VALID_CPF,
      "50000000",
      "100",
      "não",
      "1990",
    ]);
    expect(r.text).toBe(INVALID_BIRTH_DATE_MESSAGE);
    expect(r.session.step).toBe("birth_date");
  });
});

describe("advanceCheckout — pessoa jurídica", () => {
  it("pede CNPJ e não pergunta nascimento", async () => {
    const cart = cartWith(["Bolsa", 200, 1]);
    const r = await run(cart, [
      "Loja X",
      "pessoa jurídica",
      VALID_CNPJ,
      "50000000",
      "500",
      "não",
    ]);
    expect(r.session.customer.cnpj).toBe(VALID_CNPJ);
    expect(r.session.customer.birthDate).toBeNull();
    expect(r.session.step).toBe("fulfillment");
    expect(r.text).toBe(PROMPTS.fulfillment);
  });

  it("pergunta o CNPJ após escolher PJ", async () => {
    const cart = cartWith(["Bolsa", 200, 1]);
    const r = await run(cart, ["Loja X", "pj"]);
    expect(r.text).toBe(CNPJ_PROMPT);
  });

  it("rejeita CNPJ inválido", async () => {
    const cart = cartWith(["Bolsa", 200, 1]);
    const r = await run(cart, ["Loja X", "pj", "11111111111111"]);
    expect(r.text).toBe(INVALID_CNPJ_MESSAGE);
    expect(r.session.step).toBe("document");
  });
});

describe("advanceCheckout — CEP", () => {
  it("rejeita formato inválido", async () => {
    const cart = cartWith(["Bolsa", 200, 1]);
    const r = await run(cart, ["Maria", "pf", VALID_CPF, "123"]);
    expect(r.text).toBe(INVALID_CEP_MESSAGE);
    expect(r.session.step).toBe("zip_code");
  });

  it("avisa quando o CEP não é encontrado", async () => {
    const cart = cartWith(["Bolsa", 200, 1]);
    const r = await run(cart, ["Maria", "pf", VALID_CPF, "99999999"]);
    expect(r.text).toBe(CEP_NOT_FOUND_MESSAGE);
    expect(r.session.step).toBe("zip_code");
  });

  it("preenche o endereço automaticamente e pede só o número", async () => {
    const cart = cartWith(["Bolsa", 200, 1]);
    const r = await run(cart, ["Maria", "pf", VALID_CPF, "50000000"]);
    expect(r.text).toContain("Rua A");
    expect(r.text).toContain("Recife/PE");
    expect(r.text).toContain(PROMPTS.address_number);
  });
});

describe("advanceCheckout — retirada e entrega", () => {
  const answers = ["Maria", "pf", VALID_CPF, "50000000", "100", "não", "05/03/1990"];

  it("retirada ignora o endereço no resumo", async () => {
    const cart = cartWith(["Bolsa", 200, 1]);
    const r = await run(cart, [...answers, "retirada", "dinheiro"]);
    expect(r.session.fulfillment).toBe("pickup");
    expect(r.text).toContain("🏪 Retirada na loja");
    expect(r.text).not.toContain("🚚");
  });

  it("entrega mostra o endereço completo", async () => {
    const cart = cartWith(["Bolsa", 200, 1]);
    const r = await run(cart, [...answers, "entrega", "cartão"]);
    expect(r.session.fulfillment).toBe("delivery");
    expect(r.text).toContain("🚚 Entrega");
    expect(r.text).toContain("Rua A, 100");
    expect(r.text).toContain("Recife/PE");
  });
});

describe("formatCheckoutSummary", () => {
  it("mostra cliente, documento, nascimento, endereço, itens e total", async () => {
    const cart = cartWith(["Bolsa", 200, 2], ["Carteira", 89.9, 1]);
    const r = await run(cart, [
      "Maria Silva",
      "pf",
      VALID_CPF,
      "50000000",
      "100",
      "não",
      "05/03/1990",
      "entrega",
      "cartão",
    ]);
    const text = formatCheckoutSummary(r.session, cart);
    expect(text).toContain("🛍️ *Resumo do Pedido*");
    expect(text).toContain("Cliente: Maria Silva");
    expect(text).toContain("CPF: 529.982.247-25");
    expect(text).toContain("Nascimento: 05/03/1990");
    expect(text).toContain("2x Bolsa");
    expect(text).toContain("Carteira");
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

  const turn = (text: string, now?: number) =>
    handleCheckoutTurn({ companyId: "co", phone: "5511", text, now, resolveCep });

  it("ignora mensagens fora do fluxo", async () => {
    expect(await turn("bom dia")).toBeNull();
  });

  it("avisa quando o carrinho está vazio", async () => {
    const out = await turn("fechar pedido");
    expect(out?.text).toBe(EMPTY_CART_MESSAGE);
    expect(peekCheckoutSession("co", "5511")).toBeNull();
  });

  it("executa o fluxo completo com retirada", async () => {
    fillCart();
    expect((await turn("quero finalizar"))?.text).toBe(PROMPTS.buyer_name);
    expect((await turn("Maria"))?.text).toBe(PROMPTS.person_type);
    expect((await turn("pessoa física"))?.text).toBe(PROMPTS.document);
    expect((await turn(VALID_CPF))?.text).toBe(PROMPTS.zip_code);
    expect((await turn("50000-000"))?.text).toContain(PROMPTS.address_number);
    expect((await turn("100"))?.text).toBe(PROMPTS.address_complement);
    expect((await turn("não"))?.text).toBe(PROMPTS.birth_date);
    expect((await turn("05/03/1990"))?.text).toBe(PROMPTS.fulfillment);
    expect((await turn("retirada"))?.text).toBe(PROMPTS.payment);
    const summary = await turn("dinheiro");
    expect(summary?.step).toBe("summary");
    expect(summary?.text).toContain("Dinheiro");
    expect(summary?.text).toContain("200,00");
  });

  it("abandona o fluxo mantendo o carrinho", async () => {
    fillCart();
    await turn("fechar");
    const out = await turn("cancelar");
    expect(out?.text).toBe(CHECKOUT_ABORTED_MESSAGE);
    expect(peekCheckoutSession("co", "5511")).toBeNull();
    expect(getCartSession("co", "5511").items).toHaveLength(1);
  });

  it("reinicia o checkout quando pedido", async () => {
    fillCart();
    await turn("fechar");
    await turn("Maria");
    const out = await turn("recomeçar");
    expect(out?.text).toBe(PROMPTS.buyer_name);
    expect(peekCheckoutSession("co", "5511")?.customer.fullName).toBeNull();
  });

  it("descarta a sessão expirada e recomeça do zero", async () => {
    const t0 = 1_000_000;
    fillCart(t0);
    saveCheckoutSession({
      ...createCheckoutSession("co", "5511", t0),
      step: "payment",
      buyerName: "Maria",
    });
    const later = t0 + CHECKOUT_SESSION_TTL_MS + 1;
    saveCartSession({ ...getCartSession("co", "5511", t0), updatedAt: later });
    const out = await turn("quero finalizar", later);
    expect(out?.step).toBe("buyer_name");
  });
});
