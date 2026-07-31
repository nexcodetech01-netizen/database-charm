import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Supplier = Tables<"product_suppliers">;
export type SupplierInsert = TablesInsert<"product_suppliers">;
export type SupplierUpdate = TablesUpdate<"product_suppliers">;

export type SupplierStatus = "active" | "inactive" | "archived";

export const SUPPLIER_STATUS_OPTIONS: { value: SupplierStatus; label: string }[] = [
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Inativo" },
  { value: "archived", label: "Arquivado" },
];

export const PAYMENT_TERM_OPTIONS = [
  { value: "a_vista", label: "À vista" },
  { value: "7d", label: "7 dias" },
  { value: "14d", label: "14 dias" },
  { value: "21d", label: "21 dias" },
  { value: "28d", label: "28 dias" },
  { value: "30d", label: "30 dias" },
  { value: "45d", label: "45 dias" },
  { value: "60d", label: "60 dias" },
  { value: "30_60", label: "30/60 dias" },
  { value: "30_60_90", label: "30/60/90 dias" },
];

export const BR_STATES = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
] as const;

export interface SupplierWithMeta extends Supplier {
  products_count: number;
  last_purchase_at: string | null;
  total_purchased: number;
  purchases_count: number;
}

export interface SupplierPurchaseSummary {
  id: string;
  number: string;
  status: string;
  purchase_date: string;
  received_at: string | null;
  grand_total: number;
  items_total: number;
}

export interface SupplierTimelineEvent {
  id: string;
  kind: "created" | "updated" | "purchase" | "purchase_received";
  at: string;
  title: string;
  description?: string;
}



export type SupplierSortKey = "name" | "created_at" | "city";
export type SupplierSortDir = "asc" | "desc";

export interface SupplierListFilters {
  search: string;
  status: string;
  state: string;
  sortBy: SupplierSortKey;
  sortDir: SupplierSortDir;
  page: number;
  pageSize: number;
}
