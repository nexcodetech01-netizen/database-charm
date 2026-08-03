import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { applyProductSearch } from "@/features/products/lib/product-search";
import {
  createSearchCache,
  searchCacheKey,
  type PdvSearchOption,
} from "../lib/search-cache";
import { usePdvCatalogIndex } from "./use-pdv-catalog-index";

/**
 * Busca de produtos do PDV.
 *
 * Reutiliza a estratégia única `applyProductSearch` (SEARCH-001) — a mesma
 * usada por Produtos, Vendas e Compras. Nenhuma query nova de negócio.
 *
 * Sprint 2.8: resultados ficam em cache de curto prazo (por termo) e
 * requisições simultâneas para o mesmo termo são compartilhadas, evitando
 * consultas repetidas durante a operação contínua.
 *
 * RC2 (P0.4): o catálogo ativo é pré-carregado uma vez e indexado em
 * memória. Um bipe com casamento EXATO (código de barras / SKU / referência)
 * é resolvido localmente, sem round-trip. Termos ambíguos seguem para a
 * busca no servidor, com a mesma estratégia de sempre.
 */
export function usePdvProductSearch(companyId: string, term: string) {
  const [options, setOptions] = useState<PdvSearchOption[]>([]);
  const [isSearching, setSearching] = useState(false);
  const { match } = usePdvCatalogIndex(companyId);
  const matchRef = useRef(match);
  matchRef.current = match;

  const cache = useMemo(
    () => createSearchCache<PdvSearchOption[]>({ ttlMs: 30_000, max: 40 }),
    // Cache é por empresa: trocar de empresa invalida tudo.
    [companyId],
  );
  const inflight = useRef(new Map<string, Promise<PdvSearchOption[]>>());

  /** Consulta bruta (com cache + deduplicação). Usada pela lista e pelo ENTER. */
  const lookup = useCallback(
    async (rawTerm: string): Promise<PdvSearchOption[]> => {
      const key = searchCacheKey(rawTerm);
      if (!key) return [];

      const cached = cache.get(key);
      if (cached) return cached;

      // Resposta instantânea do índice local (leitor USB / prefetch).
      const local = matchRef.current(key);
      if (local) return [local];

      const pending = inflight.current.get(key);
      if (pending) return pending;

      const request = (async () => {
        let q = supabase
          .from("products")
          .select("id,name,sku,barcode,brand,price,cost,stock,unit")
          .eq("company_id", companyId)
          .eq("status", "active");
        q = applyProductSearch(q, rawTerm, { salesChannel: "loja_fisica" });
        const { data } = await q.limit(10);
        const mapped: PdvSearchOption[] = (data ?? []).map((p) => ({
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
        cache.set(key, mapped);
        return mapped;
      })().finally(() => {
        inflight.current.delete(key);
      });

      inflight.current.set(key, request);
      return request;
    },
    [cache, companyId],
  );

  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) {
      setOptions([]);
      setSearching(false);
      return;
    }

    // Resposta instantânea quando o termo já foi consultado.
    const cached = cache.get(query);
    if (cached) {
      setOptions(cached);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      void (async () => {
        const result = await lookup(query);
        if (cancelled) return;
        setOptions(result);
        setSearching(false);
      })();
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cache, lookup, term]);

  return { options, isSearching, lookup };
}
