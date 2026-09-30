import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mantém estoque e produtos iguais para todas as pessoas logadas na mesma
 * empresa.
 *
 * Problema (2026-09-29): as listas de produtos têm cache de 5 min e não
 * recarregam ao voltar para a tela. Cada pessoa via o estoque de quando
 * abriu o app + as próprias alterações — a venda da sócia não aparecia até
 * um F5, e os números divergiam entre os logins.
 *
 * Solução: escuta (Supabase Realtime) mudanças em `products` e novos
 * lançamentos em `inventory_movements` da empresa e invalida os caches que
 * mostram estoque. Rajadas (ex.: uma venda com 10 itens) viram uma única
 * recarga.
 */

/** Prefixos de cache que exibem estoque ou dados de produto. */
export const STOCK_QUERY_PREFIXES: readonly (readonly string[])[] = [
  ["products"],
  ["inventory"],
  ["inv-product-picker"],
  ["pdv", "catalog-index"],
  ["accounting-ai", "summary"],
];

const DEBOUNCE_MS = 400;

export function invalidateStockQueries(qc: QueryClient): void {
  for (const queryKey of STOCK_QUERY_PREFIXES) {
        // "all": listas de produtos usam refetchOnMount: false, então uma
    // query inativa só invalidada seria mostrada velha ao voltar à tela.
    void qc.invalidateQueries({ queryKey: [...queryKey], refetchType: "all" });
  }
}

export function useInventoryRealtime(companyId: string | null | undefined): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!companyId) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        invalidateStockQueries(qc);
      }, DEBOUNCE_MS);
    };

        const filter = `company_id=eq.${companyId}`;
    // Reconexão (internet caiu, computador hibernou): eventos desse
    // intervalo se perderam, então recarrega tudo uma vez.
    let subscribedOnce = false;
    const channel = supabase
      .channel(`inventory-sync-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "products", filter }, schedule)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inventory_movements", filter },
                schedule,
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        if (subscribedOnce) schedule();
        subscribedOnce = true;
      });

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [companyId, qc]);
}
