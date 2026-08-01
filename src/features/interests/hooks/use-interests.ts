import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { interestsService } from "../services/interests.service";
import { summarizeInterests, waitingCountByProduct } from "../lib/interest-insights";
import type {
  InterestListFilters,
  InterestStatus,
  ProductInterestInsert,
  ProductInterestUpdate,
} from "../types";
import { DEFAULT_INTEREST_FILTERS } from "../types";

export const interestsKeys = {
  all: ["product-interests"] as const,
  list: (companyId: string, filters: InterestListFilters) =>
    ["product-interests", "list", companyId, filters] as const,
  byProduct: (productId: string) =>
    ["product-interests", "product", productId] as const,
  byCustomer: (customerId: string) =>
    ["product-interests", "customer", customerId] as const,
};

export function useInterestsList(companyId: string, filters: InterestListFilters) {
  return useQuery({
    queryKey: interestsKeys.list(companyId, filters),
    queryFn: () => interestsService.list(companyId, filters),
    enabled: !!companyId,
  });
}

/** Resumo agregado (dashboard, insights e sugestão de compra). */
export function useInterestSummary(companyId: string) {
  const query = useQuery({
    queryKey: interestsKeys.list(companyId, DEFAULT_INTEREST_FILTERS),
    queryFn: () => interestsService.list(companyId, DEFAULT_INTEREST_FILTERS),
    enabled: !!companyId,
  });
  const rows = query.data ?? [];
  return {
    ...query,
    summary: summarizeInterests(rows),
    waitingByProduct: waitingCountByProduct(rows),
  };
}

export function useProductInterests(productId: string) {
  return useQuery({
    queryKey: interestsKeys.byProduct(productId),
    queryFn: () => interestsService.listByProduct(productId),
    enabled: !!productId,
  });
}

export function useCustomerInterests(customerId: string) {
  return useQuery({
    queryKey: interestsKeys.byCustomer(customerId),
    queryFn: () => interestsService.listByCustomer(customerId),
    enabled: !!customerId,
  });
}

export function useCreateInterest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProductInterestInsert) => interestsService.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: interestsKeys.all }),
  });
}

export function useUpdateInterest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ProductInterestUpdate }) =>
      interestsService.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: interestsKeys.all }),
  });
}

export function useSetInterestStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: InterestStatus }) =>
      interestsService.setStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: interestsKeys.all }),
  });
}

export function useDeleteInterest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => interestsService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: interestsKeys.all }),
  });
}
