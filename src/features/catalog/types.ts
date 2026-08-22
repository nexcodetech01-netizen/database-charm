import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Collection = Tables<"product_collections">;
export type CollectionInsert = TablesInsert<"product_collections">;
export type CollectionUpdate = TablesUpdate<"product_collections">;
export type CollectionItem = Tables<"product_collection_items">;

export type CollectionStatus = "active" | "hidden" | "scheduled";

export const COLLECTION_STATUS_OPTIONS: {
  value: CollectionStatus;
  label: string;
}[] = [
  { value: "active", label: "Ativa" },
  { value: "hidden", label: "Oculta" },
  { value: "scheduled", label: "Agendada" },
];

export interface CollectionWithCount extends Collection {
  product_count: number;
}

export type CatalogCta = "whatsapp" | "entrada" | "comprar_agora" | "none";

export type CtaMode = "whatsapp" | "entrada" | "comprar_agora";

export const CTA_MODE_OPTIONS: { value: CtaMode; label: string; description: string }[] = [
  { value: "whatsapp", label: "WhatsApp", description: "Direciona o cliente para conversa no WhatsApp." },
  { value: "entrada", label: "Pagar entrada", description: "Cliente paga entrada via Bella Pay (PIX)." },
  { value: "comprar_agora", label: "Comprar agora", description: "Reservado para futuras versões." },
];

export interface CollectionVisibility {
  show_price: boolean;
  show_installments: boolean;
  show_stock: boolean;
  show_brand: boolean;
}

export interface PublicCollectionProduct {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  brand: string | null;
  category_name: string | null;
  tags: string[];
  description: string | null;
  price: number;
  stock: number;
  unit: string;
  cover_url: string | null;
  installment_max?: number | null;
}

export interface PublicCollection extends CollectionVisibility {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  status: CollectionStatus;
  company_name: string;
  installment_max: number | null;
  cta: CatalogCta;
  cta_mode: CtaMode;
  whatsapp_phone: string | null;
  entrada_percent: number;
  products: PublicCollectionProduct[];
  categories: string[];
}

export interface PublicProductImage {
  path: string;
  url: string;
  focal_x?: number;
  focal_y?: number;
  zoom?: number;
}

export interface PublicRelatedProduct {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  stock: number;
  cover_url: string | null;
}

export interface PublicProductDetail extends CollectionVisibility {
  id: string;
  name: string;
  brand: string | null;
  description: string | null;
  price: number;
  stock: number;
  unit: string;
  images: PublicProductImage[];
  collection: {
    id: string;
    slug: string;
    name: string;
  };
  company_name: string;
  installment_max: number | null;
  pix_discount_percent: number | null;
  cta: CatalogCta;
  cta_mode: CtaMode;
  whatsapp_phone: string | null;
  entrada_percent: number;
  related: PublicRelatedProduct[];
}

