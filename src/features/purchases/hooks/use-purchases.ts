import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { purchasesService } from "../services/purchases.service";
import { productsKeys } from "@/features/products/hooks/use-products";
import { inventoryKeys } from "@/features/inventory/hooks/use-inventory";
import type {
  PurchaseInsert,
  PurchaseItemDraft,
  PurchaseListFilters,
  PurchaseUpdate,
} from "../types";

/**
 * Após alterar uma compra, refletimos o impacto imediato no restante do sistema:
 * a compra recebida atualiza estoque, custo médio e KPIs de produtos via triggers
 * no banco — o front precisa reidratar essas caches para o usuário ver os cards
 * do dashboard de Produtos e o Estoque atualizados sem refresh manual.
 */
function invalidatePurchaseImpact(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: purchasesKeys.all });
  qc.invalidateQueries({ queryKey: productsKeys.all });
  qc.invalidateQueries({ queryKey: inventoryKeys.all });
}


export const purchasesKeys = {
  all: ["purchases"] as const,
  list: (companyId: string, filters: PurchaseListFilters) =>
    ["purchases", "list", companyId, filters] as const,
  metrics: (companyId: string) => ["purchases", "metrics", companyId] as const,
  detail: (id: string) => ["purchases", "detail", id] as const,
  suppliers: (companyId: string) =>
    ["purchases", "active-suppliers", companyId] as const,
};

export function usePurchasesList(companyId: string, filters: PurchaseListFilters) {
  return useQuery({
    queryKey: purchasesKeys.list(companyId, filters),
    queryFn: () => purchasesService.list(companyId, filters),
    enabled: !!companyId,
  });
}

export function usePurchaseMetrics(companyId: string) {
  return useQuery({
    queryKey: purchasesKeys.metrics(companyId),
    queryFn: () => purchasesService.metrics(companyId),
    enabled: !!companyId,
  });
}

export function usePurchase(id: string) {
  return useQuery({
    queryKey: purchasesKeys.detail(id),
    queryFn: () => purchasesService.get(id),
    enabled: !!id,
  });
}

export function useActiveSuppliersForPurchase(companyId: string) {
  return useQuery({
    queryKey: purchasesKeys.suppliers(companyId),
    queryFn: () => purchasesService.listActiveSuppliers(companyId),
    enabled: !!companyId,
  });
}

export function useCreatePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      input: Omit<PurchaseInsert, "items_total" | "grand_total"> & {
        items: PurchaseItemDraft[];
      },
    ) => purchasesService.create(input),
    onSuccess: () => invalidatePurchaseImpact(qc),
  });
}

export function useUpdatePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: PurchaseUpdate & { items?: PurchaseItemDraft[] };
    }) => purchasesService.update(id, input),
    onSuccess: () => invalidatePurchaseImpact(qc),
  });
}

export function useSetPurchaseStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      purchasesService.setStatus(id, status),
    onSuccess: () => invalidatePurchaseImpact(qc),
  });
}

export function useReprocessPurchaseReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchasesService.reprocessReceipt(id),
    onSuccess: () => invalidatePurchaseImpact(qc),
  });
}

export function useDeletePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchasesService.remove(id),
    onSuccess: () => invalidatePurchaseImpact(qc),

  });
}
