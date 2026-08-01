import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type ProductInterest = Tables<"product_interests">;
export type ProductInterestInsert = TablesInsert<"product_interests">;
export type ProductInterestUpdate = TablesUpdate<"product_interests">;

export type InterestChannel = ProductInterest["channel"];
export type InterestStatus = ProductInterest["status"];

export const INTEREST_CHANNEL_OPTIONS: { value: InterestChannel; label: string }[] = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "loja", label: "Loja" },
  { value: "telefone", label: "Telefone" },
  { value: "outro", label: "Outro" },
];

export const INTEREST_STATUS_OPTIONS: { value: InterestStatus; label: string }[] = [
  { value: "aguardando", label: "Aguardando" },
  { value: "disponivel", label: "Produto disponível" },
  { value: "avisado", label: "Cliente avisado" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];

export const INTEREST_CHANNEL_LABEL: Record<InterestChannel, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  loja: "Loja",
  telefone: "Telefone",
  outro: "Outro",
};

export const INTEREST_STATUS_LABEL: Record<InterestStatus, string> = {
  aguardando: "Aguardando",
  disponivel: "Produto disponível",
  avisado: "Cliente avisado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

/** Status considerados "em aberto" (cliente ainda espera o produto). */
export const OPEN_INTEREST_STATUSES: InterestStatus[] = [
  "aguardando",
  "disponivel",
  "avisado",
];

/** Linha do interesse com dados do produto/cliente (join de leitura). */
export interface ProductInterestRow extends ProductInterest {
  product?: { id: string; name: string; sku: string | null; stock: number | null; price: number | null } | null;
  customer?: { id: string; name: string } | null;
}

export interface InterestListFilters {
  search: string;
  status: InterestStatus | "";
  channel: InterestChannel | "";
  productId: string;
}

export const DEFAULT_INTEREST_FILTERS: InterestListFilters = {
  search: "",
  status: "",
  channel: "",
  productId: "",
};
