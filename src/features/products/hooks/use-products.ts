import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productsService } from "../services/products.service";
import { categoriesService, suppliersService } from "../services/taxonomy.service";
import { productImagesService } from "../services/product-images.service";
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
  });
}

export function useProductMetrics(companyId: string) {
  return useQuery({
    queryKey: productsKeys.metrics(companyId),
    queryFn: () => productsService.metrics(companyId),
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
  return useMutation({
    mutationFn: (input: ProductInsert) => productsService.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: productsKeys.all }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ProductUpdate }) =>
      productsService.update(id, input),
    onSuccess: async (updated, vars) => {
      // Atualização otimista: injeta o registro fresco no cache do detalhe
      // para que a UI mostre o novo estoque imediatamente, antes do refetch.
      if (updated) {
        qc.setQueryData(productsKeys.detail(vars.id), updated);
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: productsKeys.all, refetchType: "all" }),
        qc.invalidateQueries({
          queryKey: productsKeys.detail(vars.id),
          refetchType: "all",
        }),
        // Estoque depende de products.stock — sincronizar as duas áreas.
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
