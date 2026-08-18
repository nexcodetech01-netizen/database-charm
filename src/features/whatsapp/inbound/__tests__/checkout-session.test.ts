import { supabaseAdminMock } from "./session-store.mock";

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: supabaseAdminMock,
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CEP_NOT_FOUND_MESSAGE,
  CHECKOUT_ABORTED_MESSAGE,
  CHECKOUT_SESSION_TTL_MS,
  CNPJ_PROMPT,
  EMPTY_CART_MESSAGE,
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
});

describe("parsers", () => {
  it("entende retirada e entrega", () => {
    expect(parseFulfillment("retirada")).toBe("pickup");
    expect(parseFulfillment("1")).toBe("pickup");
    expect(parseFulfillment("2")).toBe("delivery");
  });

  it("entende as formas de pagamento", () => {
    expect(parsePayment("pix")).toBe("pix");
    expect(parsePayment("cartão de crédito")).toBe("card");
    expect(parsePayment("dinheiro")).toBe("cash");
  });
});

describe("advanceCheckout — pessoa física", () => {
  it("coleta nome, CPF, CEP, número, entrega, pagamento e resumo", async () => {
    const cart = cartWith(["Bolsa", 200, 1]);
    const r = await run(cart, [
      "Maria Silva",
      "pessoa física",
      VALID_CPF,
      "50000-000",
      "100",
      "Apto 202",
      "entrega",
      "pix",
    ]);
    const c = r.session.customer;
    expect(c.fullName).toBe("Maria Silva");
    expect(c.cpf).toBe(VALID_CPF);
    expect(c.zipCode).toBe("50000000");
    expect(r.session.step).toBe("summary");
    expect(r.text).toContain("Está tudo certinho?");
  });
});

describe("handleCheckoutTurn", () => {
  beforeEach(async () => {
    await resetCheckoutSessions();
    await resetCartSessions();
  });

  async function fillCart(now = Date.now()) {
    const session = await getCartSession("co", "5511", now);
    await saveCartSession(
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

  it("executa o fluxo completo com retirada", async () => {
    await fillCart();
    expect((await turn("quero finalizar"))?.text).toBe(PROMPTS.buyer_name);
    expect((await turn("Maria"))?.text).toBe(PROMPTS.person_type);
    expect((await turn("pessoa física"))?.text).toBe(PROMPTS.document);
    expect((await turn(VALID_CPF))?.text).toBe(PROMPTS.zip_code);
    expect((await turn("50000-000"))?.text).toContain(PROMPTS.address_number);
    expect((await turn("100"))?.text).toBe(PROMPTS.address_complement);
    expect((await turn("não"))?.text).toBe(PROMPTS.fulfillment);
    const summary = await turn("retirada");
    expect(summary?.step).toBe("summary");
    expect(summary?.text).toContain("Está tudo certinho?");
  });

  it("confirmado — sinaliza quando o pedido acabou de ser fechado", async () => {
    await fillCart();
    await turn("quero finalizar");
    await turn("Maria");
    await turn("pessoa física");
    await turn(VALID_CPF);
    await turn("50000-000");
    await turn("100");
    await turn("não");
    await turn("retirada");
    await turn("pix");
    const confirmTurn = await turn("sim");
    expect(confirmTurn?.confirmed).toBe(true);
  });

  it("fluxo simplificado do catálogo do site: confirmed=true na etapa final", async () => {
    await fillCart();
    let session = createCheckoutSession("co", "5511");
    session.step = "WAITING_PAYMENT_METHOD";
    session.customer.fullName = "Tiele";
    await saveCheckoutSession(session);

    await turn("dinheiro");
    await turn("não"); // Troco? Não
    await turn("52998224725"); // CPF
    await turn("Rua A, 100, 17600-000"); // Endereço
    const confirmTurn = await turn("sim");
    expect(confirmTurn?.confirmed).toBe(true);
    expect(confirmTurn?.completedSession?.customer.fullName).toBe("Tiele");
  });
});
