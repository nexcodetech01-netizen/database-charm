export interface PaymentMethodFee {
  id: string;
  company_id: string;
  method_key: string;
  label: string;
  installments: number | null;
  active: boolean;
  fee_percent: number;
  fee_fixed: number;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

/** Payload aceito ao atualizar (mantém apenas campos editáveis). */
export interface PaymentMethodFeeUpdate {
  id: string;
  active?: boolean;
  fee_percent?: number;
  fee_fixed?: number;
  label?: string;
}

export interface SaleFeeBreakdown {
  /** Chave usada para casar a taxa (ex.: pix, credit_card_2). */
  resolvedKey: string | null;
  feePercent: number;
  feeFixed: number;
  /** Valor absoluto retido pela adquirente. */
  feeAmount: number;
  /** Valor líquido = bruto − feeAmount, nunca negativo. */
  net: number;
}
