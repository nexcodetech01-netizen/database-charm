export type BellaPayEnvironment = "sandbox" | "production";
export type BellaPayConnectionStatus = "disconnected" | "connected" | "error";
export type BellaPayBillingType = "PIX" | "CREDIT_CARD" | "UNDEFINED";

export interface BellaPayConfig {
  id: string;
  company_id: string;
  api_key_sandbox: string | null;
  api_key_production: string | null;
  environment: BellaPayEnvironment;
  connection_status: BellaPayConnectionStatus;
  connection_message: string | null;
  webhook_token: string;
  last_tested_at: string | null;
  credit_card_absorb_fee: boolean;
  credit_card_fee_percent: number;
  credit_card_max_installments: number;
  /** ETAPA 2 — conta financeira que recebe as baixas do gateway. */
  default_account_id: string | null;
  created_at: string;
  updated_at: string;
}


export interface BellaPayCharge {
  id: string;
  company_id: string;
  customer_id: string | null;
  sale_id: string | null;
  financial_transaction_id: string | null;
  asaas_id: string;
  asaas_customer_id: string | null;
  billing_type: BellaPayBillingType;
  value: number;
  original_value: number | null;
  installment_count: number;
  installment_value: number | null;
  net_value: number | null;
  due_date: string;
  description: string | null;
  status: string;
  invoice_url: string | null;
  payment_link: string | null;
  pix_qr_code: string | null;
  pix_payload: string | null;
  external_reference: string | null;
  environment: BellaPayEnvironment;
  paid_at: string | null;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}


export interface BellaPayChargeWithMeta extends BellaPayCharge {
  customer_name: string | null;
  sale_number: number | null;
}

export interface BellaPayMetrics {
  total: number;
  open: number;
  openValue: number;
  received: number;
  receivedValue: number;
  overdue: number;
  overdueValue: number;
  canceled: number;
  monthReceivedValue: number;
  averagePaymentDays: number | null;
  conversionRate: number;
}

export interface CreateChargeInput {
  companyId: string;
  customerId?: string | null;
  saleId?: string | null;
  billingType: BellaPayBillingType;
  value: number;
  dueDate: string;
  description?: string;
  installmentCount?: number;
}

