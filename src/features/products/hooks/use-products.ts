import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { productsService } from "../services/products.service";
import { categoriesService, suppliersService } from "../services/taxonomy.service";
import { productImagesService } from "../services/product-images.service";
import { invalidateCatalogCache } from "@/features/catalog/lib/cache-invalidation.functions";
import type { ProductInsert, ProductListFilters, ProductUpdate } from "../types";


export const productsKeys = {
  all: ["products"] as const,
  list: (companyId: string, f: ProductListFilters) => ["products", "list", companyId, f] as const,
  metrics: (companyId: string) => ["products", "metrics", companyId] as const,
  detail: (id: string) => ["products", "detail", id] as const,
  images: (productId: string) => ["products", "images", productId] as const,
  categories: (companyId: string) => ["product-categories", companyId] as const,
  suppliers: (companyId: string) => ["product-suppliers", companyId] as const,
};

export function useProductsList(companyId: string, filters: ProductListFilters) {
  return useQuery({
    queryKey: productsKeys.list(companyId, filters),
    queryFn: () => productsService.list(companyId, filters),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useProductMetrics(companyId: string) {
  return useQuery({
    queryKey: productsKeys.metrics(companyId),
    queryFn: () => productsService.metrics(companyId),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: productsKeys.detail(id),
    queryFn: () => productsService.get(id),
    enabled: !!id,
  });
}

export function useCategories(companyId: string) {
  return useQuery({
    queryKey: productsKeys.categories(companyId),
    queryFn: () => categoriesService.list(companyId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSuppliers(companyId: string) {
  return useQuery({
    queryKey: productsKeys.suppliers(companyId),
    queryFn: () => suppliersService.list(companyId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  const invalidateCatalog = useServerFn(invalidateCatalogCache);

  return useMutation({
    mutationFn: (input: ProductInsert) => productsService.create(input),
    onSuccess: async (data) => {
      qc.invalidateQueries({ queryKey: productsKeys.all });
      
      const channels = (data?.sales_channels || []) as string[];
      if (channels.includes('catalog')) {
        // Correct usage for server function invoker
        void invalidateCatalog({ data: { slug: 'tg-style-catalogue' } });
        await qc.invalidateQueries({ queryKey: ["public-collection"] });
      }
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  const invalidateCatalog = useServerFn(invalidateCatalogCache);

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ProductUpdate }) =>
      productsService.update(id, input),
    onSuccess: async (updated, vars) => {
      // Atualização otimista
      if (updated) {
        qc.setQueryData(productsKeys.detail(vars.id), updated);
      }
      
      // Invalidação instantânea do cache da listagem
      await qc.invalidateQueries({ queryKey: productsKeys.all });
      
      // Se o produto alterado afeta o catálogo (catalog channel)
      const currentChannels = (updated?.sales_channels || []) as string[];
      if (currentChannels.includes('catalog')) {
        try {
          // Tentativa de invalidação de cache de CDN (Edge/Server)
          void invalidateCatalog({ data: { slug: 'tg-style-catalogue' } });
          // Invalida o cache do loader no TanStack Query (client-side)
          await qc.invalidateQueries({ queryKey: ["public-collection"] });
        } catch (err) {
          console.warn("[Catalog] Invalidation error:", err);
        }
      }
      
      await Promise.all([
        qc.invalidateQueries({
          queryKey: productsKeys.detail(vars.id),
          refetchType: "all",
        }),
        qc.invalidateQueries({ queryKey: ["inventory"], refetchType: "all" }),
        qc.invalidateQueries({ queryKey: ["inv-product-picker"], refetchType: "all" }),
      ]);
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => productsService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: productsKeys.all }),
  });
}

export function useDeactivateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => productsService.deactivate(id),
    onSuccess: async (_updated, id) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: productsKeys.all, refetchType: "all" }),
        qc.invalidateQueries({ queryKey: productsKeys.detail(id), refetchType: "all" }),
      ]);
    },
  });
}



export function useCreateCategory(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; targetMarginPct?: number; defaultNcm?: string }) => 
      categoriesService.create(companyId, input.name, input.targetMarginPct, input.defaultNcm),
    onSuccess: () => qc.invalidateQueries({ queryKey: productsKeys.categories(companyId) }),
  });
}

export function useUpdateCategory(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { name?: string; target_margin_pct?: number; default_ncm?: string } }) =>
      categoriesService.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: productsKeys.categories(companyId) }),
  });
}

export function useDeleteCategory(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => categoriesService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: productsKeys.categories(companyId) }),
  });
}

export function useCreateSupplier(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => suppliersService.create(companyId, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: productsKeys.suppliers(companyId) }),
  });
}

export function useProductImages(productId: string) {
  return useQuery({
    queryKey: productsKeys.images(productId),
    queryFn: () => productImagesService.list(productId),
    enabled: !!productId,
  });
}

export function useSignedImageUrls(paths: string[]) {
  return useQuery({
    queryKey: ["signed-urls", ...paths],
    queryFn: () => productImagesService.signedUrls(paths),
    enabled: paths.length > 0,
    staleTime: 30 * 60 * 1000,
  });
}
