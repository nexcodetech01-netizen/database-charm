import { useEffect } from "react";
import { useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mapPdvProduct } from "@/features/sales/pdv/hooks/use-pdv-catalog-index";
import type { PdvSearchOption } from "@/features/sales/pdv/lib/search-cache";

/**
 * Mantém estoque e produtos iguais para todas as pessoas logadas na mesma
 * empresa.
 *
 * Histórico:
 * - 2026-09-29: cada pessoa via o estoque de quando abriu o app; passou a
 *   escutar `products` + `inventory_movements` e recarregar TUDO.
 * - 2026-10-22 (auditoria 4.2): recarregar tudo a cada venda fazia todos os
 *   terminais da loja baixarem de novo o catálogo do PDV (até 2.000 produtos)
 *   e todas as listas — inclusive as que nem estavam na tela. Agora:
 *     1. Só escuta `products` (toda baixa de estoque já atualiza
 *        `products.stock` via trigger; escutar `inventory_movements` dobrava
 *        os eventos sem trazer informação nova).
 *     2. O catálogo do PDV é ATUALIZADO NA MEMÓRIA com os dados que chegam no
 *        próprio evento (preço, estoque, nome…) — zero consultas ao banco.
 *     3. Demais caches: recarrega só o que está na tela; o que não está é
 *        descartado e será buscado fresco quando a tela abrir.
 */

/** Prefixos de cache que exibem estoque ou dados de produto (exceto o PDV). */
export const STOCK_QUERY_PREFIXES: readonly (readonly string[])[] = [
  ["products"],
  ["inventory"],
  ["inv-product-picker"],
  ["accounting-ai", "summary"],
];

/** Catálogo do PDV — atualizado na memória a partir do evento. */
export const PDV_CATALOG_PREFIX = ["pdv", "catalog-index"] as const;

const DEBOUNCE_MS = 400;

type ProductRow = Record<string, unknown> & { id?: string; status?: string | null };

export interface ProductChangePayload {
  eventType?: "INSERT" | "UPDATE" | "DELETE" | string;
  new?: ProductRow | null;
  old?: ProductRow | null;
}

/**
 * Recarrega só as queries que estão na tela e descarta as inativas (as listas
 * usam `refetchOnMount: false`; descartar garante dado fresco ao voltar).
 */
function refreshPrefix(qc: QueryClient, queryKey: QueryKey): void {
  qc.removeQueries({ queryKey, type: "inactive" });
  void qc.invalidateQueries({ queryKey, refetchType: "active" });
}

export function invalidateStockQueries(qc: QueryClient, opts: { includePdv?: boolean } = {}): void {
  for (const queryKey of STOCK_QUERY_PREFIXES) refreshPrefix(qc, [...queryKey]);
  if (opts.includePdv) refreshPrefix(qc, [...PDV_CATALOG_PREFIX]);
}

/**
 * Aplica as alterações recebidas no catálogo do PDV em memória.
 * Retorna `true` quando alguma alteração não pôde ser aplicada assim
 * (produto novo/ativado que ainda não está no catálogo) — aí o chamador
 * recarrega o catálogo.
 */
export interface PendingProductChange {
  /** Linha nova completa (`null` = produto removido). */
  row: ProductRow | null;
  /** Produto criado agora (ainda não pode estar no catálogo em memória). */
  isInsert: boolean;
}

export function patchPdvCatalog(
  qc: QueryClient,
  changes: Map<string, PendingProductChange>,
): boolean {
  let needsRefetch = false;
  const seen = new Set<string>();

  qc.setQueriesData<PdvSearchOption[]>({ queryKey: [...PDV_CATALOG_PREFIX] }, (old) => {
    if (!Array.isArray(old)) return old;
    let changed = false;
    const next: PdvSearchOption[] = [];
    for (const item of old) {
      if (!changes.has(item.id)) {
        next.push(item);
        continue;
      }
      seen.add(item.id);
      changed = true;
      const row = changes.get(item.id)?.row ?? null;
      // Removido ou inativado: sai do catálogo de venda.
      if (!row || (row.status != null && row.status !== "active")) continue;
      next.push({ ...item, ...mapPdvProduct(row) });
    }
    return changed ? next : old;
  });

  // Só produto NOVO e ativo força recarregar. Um produto alterado que não
  // está em memória (catálogo maior que o limite do PDV) é ignorado — senão
  // catálogos grandes voltariam a recarregar tudo a cada venda.
  for (const [id, change] of changes) {
    const row = change.row;
    if (
      change.isInsert &&
      row &&
      (row.status == null || row.status === "active") &&
      !seen.has(id)
    ) {
      needsRefetch = true;
      break;
    }
  }
  return needsRefetch;
}

export function useInventoryRealtime(companyId: string | null | undefined): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!companyId) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending = new Map<string, PendingProductChange>();
    let fullRefresh = false;

    const flush = () => {
      timer = null;
      const changes = pending;
      const refreshAll = fullRefresh;
      pending = new Map();
      fullRefresh = false;

      if (refreshAll) {
        invalidateStockQueries(qc, { includePdv: true });
        return;
      }
      const pdvNeedsRefetch = changes.size > 0 && patchPdvCatalog(qc, changes);
      invalidateStockQueries(qc, { includePdv: pdvNeedsRefetch });
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, DEBOUNCE_MS);
    };

    const onProductChange = (payload?: ProductChangePayload) => {
      const row = (
        payload?.new && Object.keys(payload.new).length > 0 ? payload.new : null
      ) as ProductRow | null;
      const id = (row?.id ?? payload?.old?.id) as string | undefined;
      if (!id) {
        fullRefresh = true; // evento sem dados úteis: recarrega com segurança
      } else {
        const isDelete = payload?.eventType === "DELETE";
        const prev = pending.get(id);
        pending.set(id, {
          row: isDelete ? null : row,
          isInsert: Boolean(prev?.isInsert) || payload?.eventType === "INSERT",
        });
        if (payload?.eventType !== "DELETE" && !row) fullRefresh = true;
      }
      schedule();
    };

    const filter = `company_id=eq.${companyId}`;
    // Reconexão (internet caiu, computador hibernou): eventos desse
    // intervalo se perderam, então recarrega tudo uma vez.
    let subscribedOnce = false;
    const channel = supabase
      .channel(`inventory-sync-${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products", filter },
        onProductChange as (payload: unknown) => void,
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        if (subscribedOnce) {
          fullRefresh = true;
          schedule();
        }
        subscribedOnce = true;
      });

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [companyId, qc]);
}
