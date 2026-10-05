import { afterEach, describe, expect, it, vi } from "vitest";
import { getSuspendedSales, saveSuspendedSale } from "./suspended-sales";

const sale = {
  id: "s1",
  number: "PDV-1",
  timestamp: "2026-10-04T10:00:00Z",
  customerId: "",
  customerName: null,
  itemCount: 1,
  total: 10,
  state: {} as never,
};

describe("vendas suspensas", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("grava e lê a venda suspensa", () => {
    expect(saveSuspendedSale("c1", sale)).toBe(true);
    expect(getSuspendedSales("c1")).toHaveLength(1);
  });

  it("avisa (false) quando o navegador recusa gravar", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(saveSuspendedSale("c1", sale)).toBe(false);
  });

  it("ignora conteúdo corrompido no navegador", () => {
    localStorage.setItem("nexos_pdv_suspended_sales_c1", '{"não":"é lista"}');
    expect(getSuspendedSales("c1")).toEqual([]);
  });
});
