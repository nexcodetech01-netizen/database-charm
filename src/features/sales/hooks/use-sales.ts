import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { salesService } from "../services/sales.service";
import { useDataScope, type DataScope } from "../lib/test-data-scope";
import type {
  SaleInsert,
  SaleItemDraft,
  SaleListFilters,
  SaleUpdate,
} from "../types";

export const salesKeys = {
  all: ["sales"] as const,
  list: (companyId: string, filters: SaleListFilters) =>
    ["sales", "list", companyId, filters] as const,
  metrics: (companyId: string, range?: { from: string; to: string }, period?: string) =>
    ["sales", "metrics", companyId, range ?? null, period ?? null] as const,
  statusBreakdown: (companyId: string, range?: { from: string; to: string }) =>
    ["sales", "status-breakdown", companyId, range ?? null] as const,
  detail: (id: string) => ["sales", "detail", id] as const,
  customers: (companyId: string) =>
    ["sales", "active-customers", companyId] as const,
};


function invalidateSalesSummaries(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["sales", "list"] });
  void qc.invalidateQueries({ queryKey: ["sales", "metrics"] });
  void qc.invalidateQueries({ queryKey: ["sales", "status-breakdown"] });
}

export function useSalesStatusBreakdown(
  companyId: string,
  range?: { from: string; to: string },
) {
  return useQuery({
    queryKey: salesKeys.statusBreakdown(companyId, range),
    queryFn: () => salesService.statusBreakdown(companyId, range),
    enabled: !!companyId,
  });
}


function markSaleDetailStaleWithoutRefetch(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
) {
  // A query de detalhe permanece montada no editor. Um refetch imediato aqui
  // substituiria o snapshot local do formulário no meio da transição
  // itens → checkout → itens. Marcá-la como stale garante atualização apenas
  // quando outro consumidor montar a tela de detalhe.
  void qc.invalidateQueries({
    queryKey: salesKeys.detail(id),
    exact: true,
    refetchType: "none",
  });
}

export function useSalesList(companyId: string, filters: SaleListFilters) {
  const scope = useDataScope();
  return useQuery({
    queryKey: [...salesKeys.list(companyId, filters), scope],
    queryFn: () => salesService.list(companyId, filters, scope),
    enabled: !!companyId,
  });
}

export function useSaleMetrics(
  companyId: string,
  range?: { from: string; to: string },
  scopeOverride?: DataScope,
) {
  const globalScope = useDataScope();
  const scope = scopeOverride ?? globalScope;
  return useQuery({
    queryKey: [...salesKeys.metrics(companyId, range), scope],
    queryFn: () => salesService.metrics(companyId, range, scope),
    enabled: !!companyId,
  });
}


export function useSale(id: string) {
  return useQuery({
    queryKey: salesKeys.detail(id),
    queryFn: () => salesService.get(id),
    enabled: !!id,
  });
}

export function useActiveCustomersForSale(companyId: string) {
  return useQuery({
    queryKey: salesKeys.customers(companyId),
    queryFn: () => salesService.listActiveCustomers(companyId),
    enabled: !!companyId,
  });
}

export function useCreateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      input: Omit<SaleInsert, "items_total" | "grand_total"> & {
        items: SaleItemDraft[];
      },
    ) => salesService.create(input),
    onSuccess: () => {
      invalidateSalesSummaries(qc);
      void qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useUpdateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: SaleUpdate & { items?: SaleItemDraft[] };
    }) => salesService.update(id, input),
    onSuccess: (_updated, variables) => {
      markSaleDetailStaleWithoutRefetch(qc, variables.id);
      invalidateSalesSummaries(qc);
      void qc.invalidateQueries({ queryKey: ["inventory"] });
      // FIN-006 — Ao alterar payment_method / sale_date / due_date do rascunho,
      // o trigger `apply_receivable_sale_trg` sincroniza o vencimento em
      // financial_transactions. Invalida os caches financeiros para refletir
      // no Dashboard e nos painéis de Contas a Receber imediatamente.
      void qc.invalidateQueries({ queryKey: ["finance"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },

  });
}

export function useSetSaleStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: string;
      reason?: string | null;
    }) =>
      status === "cancelled"
        ? salesService.cancel(id, reason)
        : salesService.setStatus(id, status),
    onSuccess: (_updated, variables) => {
      qc.setQueryData(salesKeys.detail(variables.id), (current: unknown) =>
        current && typeof current === "object"
          ? { ...current, status: variables.status }
          : current,
      );
      markSaleDetailStaleWithoutRefetch(qc, variables.id);
      invalidateSalesSummaries(qc);
      void qc.invalidateQueries({ queryKey: ["inventory"] });
      void qc.invalidateQueries({ queryKey: ["finance"] });
      // ML-Sync: se o estoque mudou por causa da venda (paid/cancelled),
      // dispara sync fire-and-forget para todo produto com ml_item_id
      // presente nesta venda.
      if (variables.status === "paid" || variables.status === "cancelled") {
        void (async () => {
          try {
            const { supabase } = await import("@/integrations/supabase/client");
            const { data } = await supabase
              .from("sale_items")
              .select("product_id, products:product_id(ml_item_id)")
              .eq("sale_id", variables.id);
            const productIds = (data ?? [])
              .filter(
                (r: { products?: { ml_item_id?: string | null } | null }) =>
                  r.products?.ml_item_id,
              )
              .map((r: { product_id: string | null }) => r.product_id)
              .filter((v): v is string => !!v);
            if (productIds.length === 0) return;
            const { syncProductToMercadoLivre } = await import(
              "@/lib/mercadolivre-sync.functions"
            );
            await Promise.all(
              productIds.map((pid) =>
                syncProductToMercadoLivre({ data: { productId: pid } }).catch(
                  () => {},
                ),
              ),
            );
          } catch {
            /* silencioso */
          }
        })();
      }
    },
  });
}

export function useDeleteSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => salesService.remove(id),
    onSuccess: () => invalidateSalesSummaries(qc),
  });
}
