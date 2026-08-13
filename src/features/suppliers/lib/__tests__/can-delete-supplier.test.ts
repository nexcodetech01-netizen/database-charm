import { describe, it, expect } from "vitest";
import { canDeleteSupplier } from "../can-delete-supplier";

function supplier(over: Partial<{ products_count: number; purchases_count: number; name: string }>) {
  return { products_count: 0, purchases_count: 0, name: "Fornecedor X", ...over };
}

describe("canDeleteSupplier", () => {
  it("permite excluir fornecedor sem produtos nem compras", () => {
    expect(canDeleteSupplier(supplier({}))).toEqual({ allowed: true });
  });

  it("bloqueia excluir fornecedor com produtos vinculados", () => {
    const result = canDeleteSupplier(supplier({ products_count: 3 }));
    expect(result.allowed).toBe(false);
  });

  it("bloqueia excluir fornecedor com histórico de compras, mesmo sem produtos vinculados (regressão do bug real)", () => {
    // Este é exatamente o cenário do bug: produtos foram todos removidos/
    // reatribuídos, mas o fornecedor ainda tem compras no histórico. A
    // FK usa ON DELETE SET NULL — sem esta trava, a exclusão "funcionava"
    // silenciosamente e apagava o fornecedor de todas as compras antigas.
    const result = canDeleteSupplier(supplier({ products_count: 0, purchases_count: 5 }));
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toMatch(/5 compra/);
    }
  });
});
