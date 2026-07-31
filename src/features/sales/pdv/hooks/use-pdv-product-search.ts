import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { applyProductSearch } from "@/features/products/lib/product-search";
import type { PDVProductOption } from "../types";

/**
 * Busca de produtos do PDV.
 *
 * Reutiliza a estratégia única `applyProductSearch` (SEARCH-001) — a mesma
 * usada por Produtos, Vendas e Compras. Nenhuma query nova de negócio.
 */
export function usePdvProductSearch(companyId: string, term: string) {
  const [options, setOptions] = useState<PDVProductOption[]>([]);
  const [isSearching, setSearching] = useState(false);

  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) {
      setOptions([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      void (async () => {
        let q = supabase
          .from("products")
          .select("id,name,sku,price,cost,stock,unit")
          .eq("company_id", companyId)
          .eq("status", "active");
        q = applyProductSearch(q, query);
        const { data } = await q.limit(10);
        if (cancelled) return;
        setOptions(
          (data ?? []).map((p) => ({
            id: p.id,
            name: p.name,
            sku: p.sku ?? null,
            price: p.price != null ? Number(p.price) : null,
            cost: p.cost != null ? Number(p.cost) : null,
            stock: p.stock != null ? Number(p.stock) : null,
            unit: p.unit ?? null,
          })),
        );
        setSearching(false);
      })();
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [companyId, term]);

  return { options, isSearching };
}
