import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { shoppingListService } from "../services/shopping-list.service";

const shoppingListKeys = {
  all: (companyId: string) => ["shopping-list", companyId] as const,
};

export function useShoppingList(companyId: string) {
  return useQuery({
    queryKey: shoppingListKeys.all(companyId),
    queryFn: () => shoppingListService.list(companyId),
    enabled: !!companyId,
  });
}

export function useAddShoppingListItem(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      quantity?: number;
      notes?: string | null;
      productId?: string | null;
      estimatedPrice?: number | null;
      category?: string | null;
    }) => shoppingListService.add({ companyId, ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: shoppingListKeys.all(companyId) }),
  });
}

export function useUpdateShoppingListItemDetails(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...patch
    }: { id: string; estimatedPrice?: number | null; category?: string | null }) =>
      shoppingListService.updateDetails(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: shoppingListKeys.all(companyId) }),
  });
}


export function useToggleShoppingListItem(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, checked }: { id: string; checked: boolean }) =>
      shoppingListService.toggleChecked(id, checked),
    onSuccess: () => qc.invalidateQueries({ queryKey: shoppingListKeys.all(companyId) }),
  });
}

export function useRemoveShoppingListItem(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => shoppingListService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: shoppingListKeys.all(companyId) }),
  });
}

export function useClearCheckedShoppingList(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => shoppingListService.clearChecked(companyId),
    onSuccess: () => qc.invalidateQueries({ queryKey: shoppingListKeys.all(companyId) }),
  });
}
