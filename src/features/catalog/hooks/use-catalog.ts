import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { catalogService } from "../services/catalog.service";
import type { CollectionInsert, CollectionUpdate } from "../types";

export const catalogKeys = {
  all: ["catalog"] as const,
  list: (companyId: string) => ["catalog", "list", companyId] as const,
  detail: (id: string) => ["catalog", "detail", id] as const,
  items: (collectionId: string) =>
    ["catalog", "items", collectionId] as const,
  uncataloged: (companyId: string) =>
    ["catalog", "uncataloged", companyId] as const,
};

export function useCollections(companyId: string) {
  return useQuery({
    queryKey: catalogKeys.list(companyId),
    queryFn: () => catalogService.list(companyId),
    enabled: !!companyId,
  });
}

export function useCollectionItems(collectionId: string | null) {
  return useQuery({
    queryKey: catalogKeys.items(collectionId ?? ""),
    queryFn: () => catalogService.listItems(collectionId!),
    enabled: !!collectionId,
  });
}

export function useUncatalogedCount(companyId: string) {
  return useQuery({
    queryKey: catalogKeys.uncataloged(companyId),
    queryFn: () => catalogService.countUncataloged(companyId),
    enabled: !!companyId,
    staleTime: 60_000,
  });
}

export function useCreateCollection(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CollectionInsert, "slug"> & { slug?: string }) =>
      catalogService.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: catalogKeys.list(companyId) });
      qc.invalidateQueries({ queryKey: catalogKeys.uncataloged(companyId) });
    },
  });
}

export function useUpdateCollection(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
      rename,
    }: {
      id: string;
      patch: CollectionUpdate;
      rename?: boolean;
    }) => catalogService.update(id, companyId, patch, { rename }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: catalogKeys.list(companyId) });
      qc.invalidateQueries({ queryKey: catalogKeys.detail(vars.id) });
    },
  });
}

export function useDeleteCollection(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => catalogService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: catalogKeys.list(companyId) });
      qc.invalidateQueries({ queryKey: catalogKeys.uncataloged(companyId) });
    },
  });
}

export function useAddCollectionProducts(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      collectionId,
      productIds,
    }: {
      collectionId: string;
      productIds: string[];
    }) => catalogService.addProducts(collectionId, productIds),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: catalogKeys.items(vars.collectionId) });
      qc.invalidateQueries({ queryKey: catalogKeys.list(companyId) });
      qc.invalidateQueries({ queryKey: catalogKeys.uncataloged(companyId) });
    },
  });
}

export function useRemoveCollectionItem(
  companyId: string,
  collectionId: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => catalogService.removeItem(itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: catalogKeys.items(collectionId) });
      qc.invalidateQueries({ queryKey: catalogKeys.list(companyId) });
      qc.invalidateQueries({ queryKey: catalogKeys.uncataloged(companyId) });
    },
  });
}
