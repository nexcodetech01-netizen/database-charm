import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Product = Tables<"products">;
export type ProductInsert = TablesInsert<"products">;
export type ProductUpdate = TablesUpdate<"products">;
export type ProductCategory = Tables<"product_categories">;
export type ProductSupplier = Tables<"product_suppliers">;
export type ProductImage = Tables<"product_images">;

export type ProductStatus = "active" | "inactive" | "draft";

export const PRODUCT_STATUS_OPTIONS: { value: ProductStatus; label: string }[] = [
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Inativo" },
  { value: "draft", label: "Rascunho" },
];

export const PRODUCT_UNIT_OPTIONS = [
  { value: "un", label: "Unidade (un)" },
  { value: "cx", label: "Caixa (cx)" },
  { value: "kg", label: "Quilograma (kg)" },
  { value: "g", label: "Grama (g)" },
  { value: "l", label: "Litro (l)" },
  { value: "ml", label: "Mililitro (ml)" },
  { value: "m", label: "Metro (m)" },
  { value: "m2", label: "Metro² (m²)" },
  { value: "pc", label: "Peça (pc)" },
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
