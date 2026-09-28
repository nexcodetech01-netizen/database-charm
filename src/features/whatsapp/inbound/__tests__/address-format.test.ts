import { describe, it, expect } from "vitest";
import { formatCustomerAddress, type CheckoutCustomer } from "../checkout-session";

describe("formatCustomerAddress (Bug Fix Verification)", () => {
  // O prefixo "Rua" não é mais inventado pelo formatador: quando o cliente
  // informa CEP, o logradouro completo vem do ViaCEP (ver generic-address).
  it("não inventa tipo de logradouro quando a rua vem sem prefixo", () => {
    const customer: CheckoutCustomer = {
      fullName: "Test User",
      personType: "pf",
      cpf: "12345678900",
      cnpj: null,
      birthDate: null,
      zipCode: "17607100",
      state: "SP",
      city: "Tupã",
      district: "Vila Espanha",
      street: "Frederico Melle",
      number: "145",
      complement: null,
    };

    const result = formatCustomerAddress(customer);
    expect(result).toBe("Frederico Melle, 145 — Vila Espanha — Tupã/SP — 17607-100");
  });

  it("Deve formatar corretamente 'Rua Frederico Melle 145, 17607100'", () => {
    const customer: CheckoutCustomer = {
      fullName: "Test User",
      personType: "pf",
      cpf: "12345678900",
      cnpj: null,
      birthDate: null,
      zipCode: "17607100",
      state: "SP",
      city: "Tupã",
      district: "Vila Espanha",
      street: "Rua Frederico Melle",
      number: "145",
      complement: null,
    };

    const result = formatCustomerAddress(customer);
    expect(result).toBe("Rua Frederico Melle, 145 — Vila Espanha — Tupã/SP — 17607-100");
  });

  it("Deve lidar com CEP grudado no logradouro se ele chegar sujo no customer.street", () => {
    const customer: CheckoutCustomer = {
      fullName: "Test User",
      personType: "pf",
      cpf: "12345678900",
      cnpj: null,
      birthDate: null,
      zipCode: "17607100",
      state: "SP",
      city: "Tupã",
      district: "Vila Espanha",
      street: "Rua Frederico Melle 17607100",
      number: "145",
      complement: null,
    };

    const result = formatCustomerAddress(customer);
    expect(result).toBe("Rua Frederico Melle, 145 — Vila Espanha — Tupã/SP — 17607-100");
  });

  it("Deve lidar com CEP grudado no número", () => {
    const customer: CheckoutCustomer = {
      fullName: "Test User",
      personType: "pf",
      cpf: "12345678900",
      cnpj: null,
      birthDate: null,
      zipCode: "17607100",
      state: "SP",
      city: "Tupã",
      district: "Vila Espanha",
      street: "Rua Frederico Melle",
      number: "145 17607100",
      complement: null,
    };

    const result = formatCustomerAddress(customer);
    expect(result).toBe("Rua Frederico Melle, 145 — Vila Espanha — Tupã/SP — 17607-100");
  });

  it("Deve formatar corretamente sem complemento", () => {
    const customer: CheckoutCustomer = {
      fullName: "Test User",
      personType: "pf",
      cpf: "12345678900",
      cnpj: null,
      birthDate: null,
      zipCode: "17607100",
      state: "SP",
      city: "Tupã",
      district: "Vila Espanha",
      street: "Rua Frederico Melle",
      number: "145",
      complement: "",
    };

    const result = formatCustomerAddress(customer);
    expect(result).toBe("Rua Frederico Melle, 145 — Vila Espanha — Tupã/SP — 17607-100");
  });
});
