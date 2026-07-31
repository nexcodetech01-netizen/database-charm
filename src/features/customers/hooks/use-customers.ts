import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customersService } from "../services/customers.service";
import { customer360Service } from "../services/customer-360.service";
import type {
  CustomerInsert,
  CustomerInteractionInsert,
  CustomerListFilters,
  CustomerUpdate,
} from "../types";

export const customersKeys = {
  all: ["customers"] as const,
  list: (companyId: string, filters: CustomerListFilters) =>
    ["customers", "list", companyId, filters] as const,
  metrics: (companyId: string) => ["customers", "metrics", companyId] as const,
  detail: (id: string) => ["customers", "detail", id] as const,
  interactions: (id: string) => ["customers", "interactions", id] as const,
  summary360: (id: string) => ["customers", "360", id] as const,
};

export function useCustomer360(id: string) {
  return useQuery({
    queryKey: customersKeys.summary360(id),
    queryFn: () => customer360Service.get(id),
    enabled: !!id,
  });
}

export function useCustomersList(companyId: string, filters: CustomerListFilters) {
  return useQuery({
    queryKey: customersKeys.list(companyId, filters),
    queryFn: () => customersService.list(companyId, filters),
    enabled: !!companyId,
  });
}

export function useCustomerMetrics(companyId: string) {
  return useQuery({
    queryKey: customersKeys.metrics(companyId),
    queryFn: () => customersService.metrics(companyId),
    enabled: !!companyId,
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: customersKeys.detail(id),
    queryFn: () => customersService.get(id),
    enabled: !!id,
  });
}

export function useCustomerInteractions(id: string) {
  return useQuery({
    queryKey: customersKeys.interactions(id),
    queryFn: () => customersService.listInteractions(id),
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CustomerInsert) => customersService.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: customersKeys.all }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CustomerUpdate }) =>
      customersService.update(id, input),
    onSuccess: async (updated, vars) => {
      // Atualiza o cache do detalhe com a linha retornada para refletir na hora,
      // e invalida (aguardando) para revalidar listas/métricas/360 antes do consumidor navegar.
      if (updated) qc.setQueryData(customersKeys.detail(vars.id), updated);
      await qc.invalidateQueries({ queryKey: customersKeys.all });
    },
  });
}

export function useArchiveCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customersService.archive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: customersKeys.all }),
  });
}
export function useRestoreCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customersService.restore(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: customersKeys.all }),
  });
}
export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customersService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: customersKeys.all }),
  });
}

export function useCreateInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CustomerInteractionInsert) => customersService.createInteraction(input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: customersKeys.interactions(vars.customer_id) });
      qc.invalidateQueries({ queryKey: customersKeys.detail(vars.customer_id) });
      qc.invalidateQueries({ queryKey: customersKeys.all });
    },
  });
}

export function useDeleteInteraction(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customersService.removeInteraction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customersKeys.interactions(customerId) });
      qc.invalidateQueries({ queryKey: customersKeys.detail(customerId) });
    },
  });
}
