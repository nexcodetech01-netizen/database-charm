import type {
  Tables,
  TablesInsert,
} from "@/integrations/supabase/types";

export type SaleReturn = Tables<"sale_returns">;
export type SaleReturnInsert = TablesInsert<"sale_returns">;
export type SaleReturnItem = Tables<"sale_return_items">;

export type ReturnStatus = "completed" | "failed";
export type RefundStatus =
  | "not_required"
  | "requested"
  | "confirmed"
  | "failed";

export const REFUND_STATUS_LABEL: Record<RefundStatus, string> = {
  not_required: "Não aplicável",
  requested: "Estorno solicitado",
  confirmed: "Estorno confirmado",
  failed: "Estorno falhou",
};

export interface SaleReturnWithItems extends SaleReturn {
  items: SaleReturnItem[];
}

export interface ReturnItemDraft {
  sale_item_id: string;
  product_id: string | null;
  description: string;
  quantity: number; // qty being returned
  unit_price: number; // unit price at sale time
  max_quantity: number; // qty originally sold minus already returned
}

export interface CreateReturnInput {
  companyId: string;
  saleId: string;
  reason: string;
  notes?: string | null;
  items: ReturnItemDraft[];
}
