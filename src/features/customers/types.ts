import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Customer = Tables<"customers">;
export type CustomerInsert = TablesInsert<"customers">;
export type CustomerUpdate = TablesUpdate<"customers">;

export type CustomerInteraction = Tables<"customer_interactions">;
export type CustomerInteractionInsert = TablesInsert<"customer_interactions">;

export type CustomerStatus = "active" | "inactive" | "archived";

export const CUSTOMER_STATUS_OPTIONS: { value: CustomerStatus; label: string }[] = [
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Inativo" },
  { value: "archived", label: "Arquivado" },
];

export const CUSTOMER_SEGMENT_OPTIONS = [
  { value: "varejo", label: "Varejo" },
  { value: "atacado", label: "Atacado" },
  { value: "corporativo", label: "Corporativo" },
  { value: "revenda", label: "Revenda" },
  { value: "vip", label: "VIP" },
  { value: "prospect", label: "Prospect" },
];

export type InteractionType = "call" | "whatsapp" | "email" | "visit" | "note";

export const INTERACTION_TYPE_OPTIONS: { value: InteractionType; label: string }[] = [
  { value: "call", label: "Ligação" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
  { value: "visit", label: "Visita" },
  { value: "note", label: "Observação" },
];

export const BR_STATES = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
] as const;

export type CustomerSortKey = "name" | "created_at" | "last_interaction_at" | "city";
export type SortDir = "asc" | "desc";

export interface CustomerListFilters {
  search: string;
  status: string;
  segment: string;
  state: string;
  sortBy: CustomerSortKey;
  sortDir: SortDir;
  page: number;
  pageSize: number;
}
