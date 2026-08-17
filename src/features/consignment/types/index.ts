import { z } from "zod";

export const consignmentStatusSchema = z.enum(["ativa", "fechada", "cancelada"]);
export type ConsignmentStatus = z.infer<typeof consignmentStatusSchema>;

export const commissionTypeSchema = z.enum(["percentual", "valor_fixo"]);
export type CommissionType = z.infer<typeof commissionTypeSchema>;

export const settlementStatusSchema = z.enum(["pendente", "pago"]);
export type SettlementStatus = z.infer<typeof settlementStatusSchema>;

export interface Reseller {
  id: string;
  company_id: string;
  name: string;
  document?: string | null;
  phone?: string | null;
  address?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Consignment {
  id: string;
  company_id: string;
  reseller_id: string;
  sent_at: string;
  commission_type?: CommissionType | null;
  commission_value?: number | null;
  status: ConsignmentStatus;
  contract_pdf_url?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  reseller?: Reseller;
}

export interface ConsignmentItem {
  id: string;
  company_id: string;
  consignment_id: string;
  product_id: string;
  sent_quantity: number;
  sold_quantity: number;
  returned_quantity: number;
  quantidade_extraviada: number;
  cost_price: number;
  suggested_price?: number | null;
  created_at: string;
  updated_at: string;
  product?: {
    name: string;
    sku: string | null;
    barcode?: string | null;
  } | null;
}

export interface ConsignmentSettlement {
  id: string;
  company_id: string;
  consignment_id: string;
  settled_at: string;
  items_snapshot: any;
  gross_amount: number;
  reseller_commission: number;
  net_receivable: number;
  payment_status: SettlementStatus;
  paid_at?: string | null;
  created_at: string;
}
