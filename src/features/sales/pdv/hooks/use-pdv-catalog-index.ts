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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  buildCatalogIndex,
  EMPTY_CATALOG_INDEX,
  type PdvCatalogIndex,
} from "../lib/catalog-index";
import type { PdvSearchOption } from "../lib/search-cache";

/** Teto de segurança: catálogos maiores continuam usando a busca no servidor. */
export const PDV_CATALOG_PREFETCH_LIMIT = 2000;
/** Primeiro lote para carregamento instantâneo. */
export const PDV_CATALOG_INITIAL_BATCH = 200;

export function usePdvCatalogIndex(
  companyId: string,
  enabled = true,
): PdvCatalogIndex & { isSyncing: boolean; isInitialLoading: boolean } {
  const queryClient = useQueryClient();

  // 1. Carregamento do lote inicial (rápido)
  const { data: initialData, isLoading: isInitialLoading } = useQuery({
    queryKey: ["pdv", "catalog-index", "initial", companyId],
    enabled: enabled && !!companyId,
    staleTime: 5 * 60_000, // 5 minutos de cache para o PDV
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<PdvSearchOption[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,sku,barcode,brand,price,cost,stock,unit")
        .eq("company_id", companyId)
        .eq("status", "active")
        .order("name")
        .limit(PDV_CATALOG_INITIAL_BATCH);
      
      if (error) throw error;
      const mapped = (data ?? []).map(mapProduct);

      // 1.5 Prefetch paralelo do catálogo completo assim que o inicial termina
      // Sem await para não bloquear o retorno do lote inicial
      queryClient.prefetchQuery({
        queryKey: ["pdv", "catalog-index", "full", companyId],
        staleTime: 5 * 60_000,
      });

      return mapped;
    },
  });

  // 2. Carregamento do catálogo completo em background
  const { data: fullData, isFetching: isSyncing } = useQuery({
    queryKey: ["pdv", "catalog-index", "full", companyId],
    enabled: enabled && !!companyId && !isInitialLoading,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
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
      return (data ?? []).map(mapProduct);
    },
  });

  const products = fullData ?? initialData ?? [];

  const index = useMemo(
    () => (products.length > 0 ? buildCatalogIndex(products) : EMPTY_CATALOG_INDEX),
    [products],
  );

  return {
    ...index,
    isSyncing,
    isInitialLoading,
  };
}

function mapProduct(p: any): PdvSearchOption {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku ?? null,
    barcode: (p as { barcode?: string | null }).barcode ?? null,
    reference: (p as { brand?: string | null }).brand ?? null,
    price: p.price != null ? Number(p.price) : null,
    cost: p.cost != null ? Number(p.cost) : null,
    stock: p.stock != null ? Number(p.stock) : null,
    unit: p.unit ?? null,
  };
}
