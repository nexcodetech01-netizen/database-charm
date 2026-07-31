import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { suppliersService } from "../services/suppliers.service";
import type { SupplierInsert, SupplierListFilters, SupplierUpdate } from "../types";

export const suppliersKeys = {
  all: ["suppliers"] as const,
  list: (companyId: string, filters: SupplierListFilters) =>
    ["suppliers", "list", companyId, filters] as const,
  metrics: (companyId: string) => ["suppliers", "metrics", companyId] as const,
  detail: (id: string) => ["suppliers", "detail", id] as const,
  products: (id: string) => ["suppliers", "products", id] as const,
  purchases: (id: string) => ["suppliers", "purchases", id] as const,
  timeline: (id: string) => ["suppliers", "timeline", id] as const,
};


export function useSuppliersList(companyId: string, filters: SupplierListFilters) {
  return useQuery({
    queryKey: suppliersKeys.list(companyId, filters),
    queryFn: () => suppliersService.list(companyId, filters),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSupplierMetrics(companyId: string) {
  return useQuery({
    queryKey: suppliersKeys.metrics(companyId),
    queryFn: () => suppliersService.metrics(companyId),
    enabled: !!companyId,
  });
}

export function useSupplier(id: string) {
  return useQuery({
    queryKey: suppliersKeys.detail(id),
    queryFn: () => suppliersService.get(id),
    enabled: !!id,
  });
}

export function useSupplierProducts(id: string) {
  return useQuery({
    queryKey: suppliersKeys.products(id),
    queryFn: () => suppliersService.listProducts(id),
    enabled: !!id,
  });
}

export function useSupplierPurchases(id: string) {
  return useQuery({
    queryKey: suppliersKeys.purchases(id),
    queryFn: () => suppliersService.listPurchases(id),
    enabled: !!id,
  });
}

export function useSupplierTimeline(supplier: { id: string; created_at: string; updated_at: string } | null | undefined) {
  return useQuery({
    queryKey: suppliersKeys.timeline(supplier?.id ?? ""),
    queryFn: () => suppliersService.timeline(supplier as never),
    enabled: !!supplier?.id,
  });
}


export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SupplierInsert) => suppliersService.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: suppliersKeys.all }),
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SupplierUpdate }) =>
      suppliersService.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: suppliersKeys.all }),
  });
}

export function useArchiveSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => suppliersService.archive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: suppliersKeys.all }),
  });
}

export function useRestoreSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => suppliersService.restore(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: suppliersKeys.all }),
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => suppliersService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: suppliersKeys.all }),
  });
}
