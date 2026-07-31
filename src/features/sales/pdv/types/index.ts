/**
 * PDV — Tipos base (Sprint 2.2).
 *
 * O carrinho do PDV é o mesmo `SaleItemDraft` usado pelo formulário de
 * vendas: nenhum modelo paralelo, nenhum motor novo.
 */
import type { SaleItemDraft } from "../../types";

/** Item do carrinho do PDV — alias explícito do draft canônico. */
export type PDVCartItem = SaleItemDraft;

/** Produto retornado pela busca do PDV. */
export type PDVProductOption = {
  id: string;
  name: string;
  sku: string | null;
  price: number | null;
  cost: number | null;
  stock: number | null;
  unit: string | null;
};
