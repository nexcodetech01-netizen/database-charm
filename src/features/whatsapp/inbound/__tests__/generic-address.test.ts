import { describe, it, expect, vi } from "vitest";
import { advanceCheckout, createCheckoutSession, type CheckoutSession, formatCustomerAddress } from "../checkout-session";
import type { CartSession } from "../cart-session";

describe("Checkout Endereço (Correção Genérica)", () => {
  const companyId = "test-company";
  const phone = "5511999999999";
  const cart: CartSession = {
    companyId,
    phone,
    items: [],
    total: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const createSession = (step: any = "WAITING_ADDRESS"): CheckoutSession => {
    const s = createCheckoutSession(companyId, phone);
    s.step = step;
    return s;
  };

  it("1. ViaCEP com Rua: Deve priorizar info.street da API", async () => {
    const session = createSession();
    const resolveCep = vi.fn().mockResolvedValue({
      street: "Rua Frederico Melle",
      neighborhood: "Vila Espanha",
      city: "Tupã",
      state: "SP",
    });

    const result = await advanceCheckout({
      session,
      cart,
      text: "Frederico Melle 145, 17607100",
      resolveCep,
    });

    expect(result.session.customer.street).toBe("Rua Frederico Melle");
    expect(result.session.customer.number).toBe("145");
    expect(result.session.customer.zipCode).toBe("17607100");
    
    const summary = formatCustomerAddress(result.session.customer);
    expect(summary).toContain("Rua Frederico Melle, 145");
  });

  it("2. ViaCEP com Avenida: Deve priorizar info.street da API", async () => {
    const session = createSession();
    const resolveCep = vi.fn().mockResolvedValue({
      street: "Avenida Brasil",
      neighborhood: "Centro",
      city: "Marília",
      state: "SP",
    });

    const result = await advanceCheckout({
      session,
      cart,
      text: "Brasil 250, 17500000",
      resolveCep,
    });

    expect(result.session.customer.street).toBe("Avenida Brasil");
    expect(result.session.customer.number).toBe("250");
    const summary = formatCustomerAddress(result.session.customer);
    expect(summary).toContain("Avenida Brasil, 250");
  });

  it("3. ViaCEP com Alameda: Deve priorizar info.street da API", async () => {
    const session = createSession();
    const resolveCep = vi.fn().mockResolvedValue({
      street: "Alameda Santos",
      neighborhood: "Cerqueira César",
      city: "São Paulo",
      state: "SP",
    });

    const result = await advanceCheckout({
      session,
      cart,
      text: "Santos 1000, 01419001",
      resolveCep,
    });

    expect(result.session.customer.street).toBe("Alameda Santos");
    const summary = formatCustomerAddress(result.session.customer);
    expect(summary).toContain("Alameda Santos, 1000");
  });

  it("7. CEP sem logradouro na API: Deve usar fallback do extractedStreet", async () => {
    const session = createSession();
    const resolveCep = vi.fn().mockResolvedValue({
      street: "", // API não tem o nome da rua
      neighborhood: "Zona Rural",
      city: "Tupã",
      state: "SP",
    });

    const result = await advanceCheckout({
      session,
      cart,
      text: "Estrada da Fazenda 500, 17600000",
      resolveCep,
    });

    expect(result.session.customer.street).toBe("Estrada da Fazenda");
    expect(result.session.customer.number).toBe("500");
    const summary = formatCustomerAddress(result.session.customer);
    expect(summary).toContain("Estrada da Fazenda, 500");
  });

  it("8. O caso 'Frederico Melle' deve funcionar sem hardcode", async () => {
    // Verificando que não há a string "Rua Frederico Melle" hardcoded se a API não retornar.
    const session = createSession();
    const resolveCep = vi.fn().mockResolvedValue({
      street: "Rua Frederico Melle",
      neighborhood: "Vila Espanha",
      city: "Tupã",
      state: "SP",
    });

    const result = await advanceCheckout({
      session,
      cart,
      text: "Frederico Melle 145, 17607100",
      resolveCep,
    });

    expect(result.session.customer.street).toBe("Rua Frederico Melle");
    const summary = formatCustomerAddress(result.session.customer);
    expect(summary).toBe("Rua Frederico Melle, 145 — Vila Espanha — Tupã/SP — 17607-100");
  });
});
