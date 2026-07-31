/**
 * PDV — Pré-carregamento leve do catálogo (RC2 / P0.4).
 *
 * Lê uma única vez (React Query, cache de 60s) os produtos ativos da empresa
 * apenas com os campos necessários para identificar o item bipado. Serve
 * exclusivamente para responder ao leitor sem round-trip.
 *
 * Somente leitura — nenhuma regra de estoque, preço ou venda é tocada.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  buildCatalogIndex,
  EMPTY_CATALOG_INDEX,
  type PdvCatalogIndex,
} from "../lib/catalog-index";
import type { PdvSearchOption } from "../lib/search-cache";

/** Teto de segurança: catálogos maiores continuam usando a busca no servidor. */
export const PDV_CATALOG_PREFETCH_LIMIT = 2000;

export function usePdvCatalogIndex(
  companyId: string,
  enabled = true,
): PdvCatalogIndex {
  const { data } = useQuery({
    queryKey: ["pdv", "catalog-index", companyId],
    enabled: enabled && !!companyId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<PdvSearchOption[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,sku,barcode,brand,price,cost,stock,unit")
        .eq("company_id", companyId)
        .eq("status", "active")
        .order("name")
        .limit(PDV_CATALOG_PREFETCH_LIMIT);
      if (error) throw error;
      return (data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku ?? null,
        barcode: (p as { barcode?: string | null }).barcode ?? null,
        reference: (p as { brand?: string | null }).brand ?? null,
        price: p.price != null ? Number(p.price) : null,
        cost: p.cost != null ? Number(p.cost) : null,
        stock: p.stock != null ? Number(p.stock) : null,
        unit: p.unit ?? null,
      }));
    },
  });

  return useMemo(
    () => (data && data.length > 0 ? buildCatalogIndex(data) : EMPTY_CATALOG_INDEX),
    [data],
  );
}
