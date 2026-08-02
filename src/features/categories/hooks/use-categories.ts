import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { categoriesService } from "../services/categories.service";
import type { CategoryInsert, CategoryUpdate } from "../types";

export const categoriesKeys = {
  all: ["categories"] as const,
  list: (companyId: string) => ["categories", "list", companyId] as const,
  duplicates: (companyId: string) => ["categories", "duplicates", companyId] as const,
};

export function useDuplicateCategories(companyId: string) {
  return useQuery({
    queryKey: categoriesKeys.duplicates(companyId),
    queryFn: () => categoriesService.previewDuplicates(companyId),
    enabled: !!companyId,
  });
}

export function useMergeCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sourceId,
      targetId,
      confirmPolicyConflict,
    }: {
      sourceId: string;
      targetId: string;
      confirmPolicyConflict?: boolean;
    }) => categoriesService.merge(sourceId, targetId, confirmPolicyConflict ?? false),
    onSuccess: () => qc.invalidateQueries({ queryKey: categoriesKeys.all }),
  });
}

export function useCategoriesList(companyId: string) {
  return useQuery({
    queryKey: categoriesKeys.list(companyId),
    queryFn: () => categoriesService.listWithCounts(companyId),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CategoryInsert) => categoriesService.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: categoriesKeys.all }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CategoryUpdate }) =>
      categoriesService.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: categoriesKeys.all }),
  });
}

export function useArchiveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => categoriesService.archive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: categoriesKeys.all }),
  });
}

export function useRestoreCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => categoriesService.restore(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: categoriesKeys.all }),
  });
}
