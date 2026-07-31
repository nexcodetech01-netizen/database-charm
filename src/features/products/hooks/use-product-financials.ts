/**
 * useProductFinancials
 * ====================
 * Fonte única da verdade para as grandezas financeiras exibidas na tela
 * de detalhes do produto. Consome as colunas cruas do registro e devolve
 * todos os derivados normalizados (custo total, lucro bruto/líquido,
 * margem real, markup, valor em estoque, etc.).
 *
 * Camada 100% de apresentação — não faz I/O, não altera dados, não
 * substitui o motor puro (`@/features/pricing/calculator`) usado por
 * server functions. Existe apenas para eliminar cálculos duplicados
 * espalhados pelos componentes visuais.
 */
import { useMemo } from "react";
import type { Product } from "@/features/products/types";

export type ProductFinancialsInput = Pick<
  Product,
  | "cost"
  | "freight"
  | "insurance"
  | "other_costs"
  | "price"
  | "margin"
  | "stock"
  | "min_stock"
>;

export interface ProductFinancials {
  /** Componentes de custo (R$). */
  cost: number;
  freight: number;
  insurance: number;
  otherCosts: number;
  /** Soma normalizada de todos os componentes de custo (R$). */
  costTotal: number;
  /** Preço de venda praticado (R$). */
  price: number;
  /** Preço − custo total, sem descontar taxa de canal. */
  grossProfit: number;
  /** (preço × (1 − fee)) − custo total, quando `feePct` é informado. */
  netProfit: number;
  /** Margem real recalculada a partir de preço e custo (líquida de fee). */
  marginPctReal: number;
  /** Margem persistida na coluna `products.margin`. */
  marginPctStored: number;
  /** marginPctReal − marginPctStored (útil para badges de divergência). */
  marginDrift: number;
  /** Markup sobre custo total (bruto). */
  markupPct: number;
  /** Estoque atual e mínimo (unidades). */
  stock: number;
  minStock: number;
  /** Valor imobilizado = estoque × custo total. */
  stockValue: number;
  /** Espelhos em centavos para consumo por componentes cents-based. */
  costCents: number;
  costTotalCents: number;
  priceCents: number;
}

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function useProductFinancials(
  product: ProductFinancialsInput | null | undefined,
  opts?: { feePct?: number },
): ProductFinancials | null {
  const feePct = opts?.feePct;
  return useMemo(() => {
    if (!product) return null;
    const cost = num(product.cost);
    const freight = num(product.freight);
    const insurance = num(product.insurance);
    const otherCosts = num(product.other_costs);
    const costTotal = cost + freight + insurance + otherCosts;
    const price = num(product.price);
    const marginStored = num(product.margin);
    const feeRate = Math.max(0, Math.min(1, num(feePct) / 100));
    const netPrice = price * (1 - feeRate);
    const grossProfit = price - costTotal;
    const netProfit = netPrice - costTotal;
    const marginPctReal = price > 0 ? (netProfit / price) * 100 : 0;
    const markupPct = costTotal > 0 ? (grossProfit / costTotal) * 100 : 0;
    const stock = num(product.stock);
    const minStock = num(product.min_stock);

    return {
      cost,
      freight,
      insurance,
      otherCosts,
      costTotal,
      price,
      grossProfit,
      netProfit,
      marginPctReal,
      marginPctStored: marginStored,
      marginDrift: marginPctReal - marginStored,
      markupPct,
      stock,
      minStock,
      stockValue: stock * costTotal,
      costCents: Math.round(cost * 100),
      costTotalCents: Math.round(costTotal * 100),
      priceCents: Math.round(price * 100),
    };
  }, [product, feePct]);
}
