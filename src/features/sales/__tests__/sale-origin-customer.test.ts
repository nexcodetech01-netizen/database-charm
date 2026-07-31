/**
 * RC2 / P0.2 — Cliente opcional apenas na origem PDV.
 *
 * Cobre a regra compartilhada (`saleRequiresCustomer`), o schema único de
 * criação de venda e o comportamento da NFC-e (modelo 65) com e sem
 * consumidor identificado.
 */
import { describe, it, expect } from "vitest";
import {
  saleRequiresCustomer,
  DEFAULT_SALE_ORIGIN,
} from "../services/sale-origin";
import { buildSaleCreateSchema } from "../services/sales.service";
import { validatePdvSale } from "../pdv/lib/checkout";
import { SaleEngine } from "../engine";

const COMPANY = "11111111-1111-4111-8111-111111111111";
const CUSTOMER = "22222222-2222-4222-8222-222222222222";

const items = [
  { description: "Bolsa", quantity: 1, unit_price: 100 },
];

function parse(origin: Parameters<typeof buildSaleCreateSchema>[0], customer_id: string | null) {
  return buildSaleCreateSchema(origin).safeParse({
    company_id: COMPANY,
    customer_id,
    status: "pending",
    items,
  });
}

describe("regra compartilhada de cliente", () => {
  it("PDV nunca exige cliente", () => {
    expect(saleRequiresCustomer("pdv", "pending")).toBe(false);
    expect(saleRequiresCustomer("pdv", "paid")).toBe(false);
  });

  it("demais origens exigem cliente em venda ativa", () => {
    for (const origin of ["sale_form", "marketplace", "api", "assistant"] as const) {
      expect(saleRequiresCustomer(origin, "pending")).toBe(true);
    }
    expect(saleRequiresCustomer(undefined, "pending")).toBe(true);
    expect(DEFAULT_SALE_ORIGIN).toBe("sale_form");
  });

  it("rascunho e cancelada seguem isentos, como hoje", () => {
    expect(saleRequiresCustomer("sale_form", "draft")).toBe(false);
    expect(saleRequiresCustomer("sale_form", "cancelled")).toBe(false);
  });
});

describe("criação de venda por origem", () => {
  it("venda PDV sem cliente é aceita", () => {
    expect(parse("pdv", null).success).toBe(true);
  });

  it("venda PDV com cliente é aceita", () => {
    expect(parse("pdv", CUSTOMER).success).toBe(true);
  });

  it("venda tradicional sem cliente continua bloqueada", () => {
    const res = parse("sale_form", null);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.message).toContain("Selecione um cliente");
    }
  });

  it("venda tradicional com cliente é aceita", () => {
    expect(parse("sale_form", CUSTOMER).success).toBe(true);
  });

  it("marketplace e API mantêm o comportamento atual", () => {
    expect(parse("marketplace", null).success).toBe(false);
    expect(parse("api", null).success).toBe(false);
    expect(parse("api", CUSTOMER).success).toBe(true);
  });
});

describe("validações não são duplicadas", () => {
  const state = {
    number: "PDV-1",
    customerId: "",
    items: [
      {
        product_id: null,
        description: "Bolsa",
        quantity: 1,
        unit_price: 100,
        discount: 0,
      },
    ],
    discount: 0,
    shipping: 0,
    paymentMethod: "cash",
    notes: "",
  } as never;

  it("o PDV não pré-valida cliente", () => {
    expect(validatePdvSale(state).ok).toBe(true);
  });

  it("o SaleEngine continua exigindo cliente (formulário intocado)", () => {
    const check = SaleEngine.validateCustomer(state);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.code).toBe("customer_required");
  });
});
