import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Product = Tables<"products"> & {
  video_url?: string | null;
};
export type ProductInsert = TablesInsert<"products">;
export type ProductUpdate = TablesUpdate<"products">;
export type ProductCategory = Tables<"product_categories">;
export type ProductSupplier = Tables<"product_suppliers">;
export type ProductImage = Tables<"product_images">;

export type ProductType = "simple" | "kit";
export type ProductStatus = "active" | "inactive" | "draft";

export const PRODUCT_STATUS_OPTIONS: { value: ProductStatus; label: string }[] = [
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Inativo" },
  { value: "draft", label: "Rascunho" },
];

export const PRODUCT_UNIT_OPTIONS = [
  { value: "UN", label: "Unidade (UN)" },
  { value: "CX", label: "Caixa (CX)" },
  { value: "KG", label: "Quilograma (KG)" },
  { value: "G", label: "Grama (G)" },
  { value: "L", label: "Litro (L)" },
  { value: "ML", label: "Mililitro (ML)" },
  { value: "M", label: "Metro (M)" },
  { value: "M2", label: "Metro² (M²)" },
  { value: "PC", label: "Peça (PC)" },
];

export const SALES_CHANNEL_OPTIONS = [
  { value: "loja_fisica", label: "Loja Física" },
  { value: "mercadolivre", label: "Mercado Livre" },
];

export type StockFilter = "all" | "in_stock" | "low" | "out";
export type SortKey = "name" | "created_at" | "price" | "stock";
export type SortDir = "asc" | "desc";

export interface ProductListFilters {
  search: string;
  categoryId: string;
  supplierId: string;
  status: string;
  stock: StockFilter;
  sortBy: SortKey;
  sortDir: SortDir;
  page: number;
  pageSize: number;
  /** Quando false (padrão), lista apenas produtos ativos e ignora SKUs mesclados. */
  includeInactive?: boolean;
}
