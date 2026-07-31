/**
 * PDV — Índice local de catálogo (RC2 / P0.4).
 *
 * Camada PURA de leitura: recebe a lista de produtos ativos já carregada e
 * devolve um índice em memória por código de barras / SKU / referência para
 * resolver o bipe do leitor SEM ida ao servidor.
 *
 * Não altera SaleEngine, SalesService, estoque, preço nem a estratégia de
 * busca (`applyProductSearch`) — o índice é apenas um atalho de leitura para
 * casamento EXATO. Qualquer termo ambíguo continua indo para a busca normal.
 */
import { searchCacheKey } from "./search-cache";
import type { PdvSearchOption } from "./search-cache";

export type PdvCatalogIndex = {
  /** Casamento exato por código de barras, SKU ou referência. */
  match: (term: string) => PdvSearchOption | null;
  size: number;
};

export const EMPTY_CATALOG_INDEX: PdvCatalogIndex = {
  match: () => null,
  size: 0,
};

export function buildCatalogIndex(
  products: PdvSearchOption[],
): PdvCatalogIndex {
  const byBarcode = new Map<string, PdvSearchOption>();
  const bySku = new Map<string, PdvSearchOption>();
  const byReference = new Map<string, PdvSearchOption>();

  const put = (map: Map<string, PdvSearchOption>, value: string | null | undefined, p: PdvSearchOption) => {
    const key = searchCacheKey(value ?? "");
    if (!key || map.has(key)) return;
    map.set(key, p);
  };

  for (const p of products) {
    put(byBarcode, p.barcode, p);
    put(bySku, p.sku, p);
    put(byReference, p.reference, p);
  }

  return {
    size: products.length,
    match(term) {
      const key = searchCacheKey(term);
      if (!key) return null;
      return byBarcode.get(key) ?? bySku.get(key) ?? byReference.get(key) ?? null;
    },
  };
}
