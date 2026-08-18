import { describe, it, expect } from "vitest";
import { formatCustomerAddress, type CheckoutCustomer } from "../checkout-session";

describe("formatCustomerAddress (Bug Fix Verification)", () => {
  it("Deve formatar corretamente 'Rua Frederico Melle 145, 17607100'", () => {
    // Simulação do que acontece no case "WAITING_ADDRESS"
    // Entrada: "Rua Frederico Melle 145, 17607100"
    // O parser extrai: 
    // extractedStreet = "Rua Frederico Melle"
    // extractedNumber = "145"
    // zip = "17607100"
    // E depois o viaCEP retorna Vila Espanha, Tupã, SP
    
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
    // Caso a normalização falhe ou o dado chegue sujo no banco/sessão
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
