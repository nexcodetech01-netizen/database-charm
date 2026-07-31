import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Category = Tables<"product_categories">;
export type CategoryInsert = TablesInsert<"product_categories">;
export type CategoryUpdate = TablesUpdate<"product_categories">;

export type CategoryStatus = "active" | "archived";

/** Category enriched with UI-relevant aggregates. */
export interface CategoryWithMeta extends Category {
  product_count: number;
  children?: CategoryWithMeta[];
}

export const CATEGORY_STATUS_OPTIONS: { value: CategoryStatus; label: string }[] = [
  { value: "active", label: "Ativa" },
  { value: "archived", label: "Arquivada" },
];

export const CATEGORY_COLORS = [
  "#2563EB",
  "#0EA5E9",
  "#16A34A",
  "#7C3AED",
  "#DB2777",
  "#DC2626",
  "#F59E0B",
  "#0F172A",
  "#64748B",
] as const;

export const CATEGORY_ICONS = [
  "Tag",
  "Package",
  "Boxes",
  "ShoppingBag",
  "Shirt",
  "Coffee",
  "Utensils",
  "Wrench",
  "Cpu",
  "Book",
  "Gift",
  "Home",
  "Car",
  "Heart",
  "Star",
  "Layers",
] as const;

export type CategoryIcon = (typeof CATEGORY_ICONS)[number];
