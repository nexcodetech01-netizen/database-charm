import { describe, expect, it } from "vitest";
import {
  computeStockInsufficiencies,
  formatInsufficiencyMessage,
  type StockCandidate,
} from "./stock-validation";

const item = (over: Partial<StockCandidate>): StockCandidate => ({
  product_id: "p1",
  description: "Produto 1",
  quantity: 1,
  stock_available: 10,
  ...over,
});

describe("computeStockInsufficiencies", () => {
  it("aprova quando quantidade é menor ou igual ao disponível", () => {
    const out = computeStockInsufficiencies([
      item({ quantity: 10, stock_available: 10 }),
      item({ product_id: "p2", quantity: 5, stock_available: 6 }),
    ]);
    expect(out).toHaveLength(0);
  });

  it("bloqueia quando quantidade excede o estoque", () => {
    const out = computeStockInsufficiencies([
      item({ quantity: 3, stock_available: 1 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ requested: 3, available: 1, shortage: 2 });
  });

  it("ignora itens sem product_id (venda avulsa)", () => {
    const out = computeStockInsufficiencies([
      item({ product_id: null, quantity: 99, stock_available: null }),
    ]);
    expect(out).toHaveLength(0);
  });

  it("ignora itens sem controle de estoque (stock_available null)", () => {
    const out = computeStockInsufficiencies([
      item({ quantity: 999, stock_available: null }),
    ]);
    expect(out).toHaveLength(0);
  });

  it("prefere o estoque fresco do banco sobre o do carrinho (consumo concorrente)", () => {
    // Carrinho pensava ter 10 disponíveis, banco agora só tem 1.
    const fresh = new Map<string, number | null>([["p1", 1]]);
    const out = computeStockInsufficiencies(
      [item({ quantity: 2, stock_available: 10 })],
      fresh,
    );
    expect(out).toHaveLength(1);
    expect(out[0].available).toBe(1);
  });

  it("respeita quando o estoque fresco indica indisponibilidade total", () => {
    const fresh = new Map<string, number | null>([["p1", 0]]);
    const out = computeStockInsufficiencies(
      [item({ quantity: 1, stock_available: 5 })],
      fresh,
    );
    expect(out[0].available).toBe(0);
    expect(out[0].shortage).toBe(1);
  });

  it("um fresh null (produto não rastreado no banco) desativa o bloqueio", () => {
    const fresh = new Map<string, number | null>([["p1", null]]);
    const out = computeStockInsufficiencies(
      [item({ quantity: 999, stock_available: 1 })],
      fresh,
    );
    expect(out).toHaveLength(0);
  });

  it("agrega múltiplas insuficiências mantendo a ordem", () => {
    const out = computeStockInsufficiencies([
      item({ product_id: "a", description: "A", quantity: 5, stock_available: 2 }),
      item({ product_id: "b", description: "B", quantity: 1, stock_available: 3 }),
      item({ product_id: "c", description: "C", quantity: 4, stock_available: 0 }),
    ]);
    expect(out.map((i) => i.item.description)).toEqual(["A", "C"]);
  });

  it("suporta quantidades fracionárias (unidades pesáveis)", () => {
    const out = computeStockInsufficiencies([
      item({ quantity: 1.75, stock_available: 1.5 }),
    ]);
    expect(out[0].shortage).toBeCloseTo(0.25, 4);
  });
});

describe("formatInsufficiencyMessage", () => {
  it("retorna vazio quando não há insuficiências", () => {
    expect(formatInsufficiencyMessage([])).toBe("");
  });

  it("resume até o limite e agrega o excedente", () => {
    const out = computeStockInsufficiencies([
      item({ product_id: "a", description: "A", quantity: 2, stock_available: 0 }),
      item({ product_id: "b", description: "B", quantity: 2, stock_available: 0 }),
      item({ product_id: "c", description: "C", quantity: 2, stock_available: 0 }),
      item({ product_id: "d", description: "D", quantity: 2, stock_available: 0 }),
    ]);
    const msg = formatInsufficiencyMessage(out, 2);
    expect(msg).toContain("A (pedido 2, disponível 0)");
    expect(msg).toContain("B (pedido 2, disponível 0)");
    expect(msg).toContain("e mais 2");
  });
});
