import { describe, expect, it } from "vitest";
import { parseAddressText } from "../address-parse";

describe("parseAddressText", () => {
  it.each([
    // [texto do cliente, rua, número, CEP, complemento]
    ["Frederico Melle 145, 17607100", "Frederico Melle", "145", "17607100", null],
    ["Rua Frederico Melle, 145, 17607-100", "Rua Frederico Melle", "145", "17607100", null],
    ["Estrada da Fazenda 10, 17607100", "Estrada da Fazenda", "10", "17607100", null],
    ["Av. Brasil 250 CEP 17500-000", "Av. Brasil", "250", "17500000", null],
    ["Rua 7 de Setembro, 100", "Rua 7 de Setembro", "100", null, null],
    ["Rua 15 de Novembro 300 - 17600-000", "Rua 15 de Novembro", "300", "17600000", null],
    ["Rua das Flores nº 45", "Rua das Flores", "45", null, null],
    ["Rua das Flores, número 45B", "Rua das Flores", "45B", null, null],
    ["Rua das Flores s/n 17600000", "Rua das Flores", "S/N", "17600000", null],
    ["Rua A, 12, apto 34, 17600-000", "Rua A", "12", "17600000", "apto 34"],
    ["Alameda Santos 1000 bloco B", "Alameda Santos", "1000", null, "bloco B"],
    ["17.607-100 Frederico Melle 145", "Frederico Melle", "145", "17607100", null],
  ])("%s", (text, street, number, zipCode, complement) => {
    expect(parseAddressText(text)).toEqual({ street, number, zipCode, complement });
  });

  it("não confunde o CEP com o número da casa", () => {
    const parsed = parseAddressText("Frederico Melle 145, 17607100");
    expect(parsed.number).not.toBe("17607100");
  });

  it("sem número informado devolve null", () => {
    expect(parseAddressText("Rua 9 de Julho").number).toBeNull();
  });
});
