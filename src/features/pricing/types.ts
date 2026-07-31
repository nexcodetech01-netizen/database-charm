/**
 * Inteligência de Precificação — tipos
 * Módulo compartilhado. Não altera fluxos de compra/venda.
 */

export type RoundingMode = "none" | "integer" | "end_90" | "end_99";

/** Política comercial de preços (por empresa) */
export interface PricingPolicy {
  /** Margens (%) alvo — sobre preço de venda */
  minMargin: number;
  idealMargin: number;
  premiumMargin: number;

  /** Taxas / custos variáveis (% sobre preço de venda) */
  pixFeePct: number;
  cardFeePct: number;
  commissionPct: number;

  /** Custos fixos por unidade (R$) — usados como default no simulador */
  avgFreight: number;
  packaging: number;
  otherCosts: number;

  /** Arredondamento aplicado ao preço final sugerido */
  rounding: RoundingMode;

  /** Canal preferencial de taxa: soma de qual taxa entra por padrão */
  defaultChannel: "pix" | "card" | "none";
}

export const DEFAULT_POLICY: PricingPolicy = {
  minMargin: 15,
  idealMargin: 30,
  premiumMargin: 45,
  pixFeePct: 0,
  cardFeePct: 3.5,
  commissionPct: 0,
  avgFreight: 0,
  packaging: 0,
  otherCosts: 0,
  rounding: "end_90",
  defaultChannel: "pix",
};

/** Entrada do simulador / calculadora */
export interface PricingInput {
  cost: number;
  freight?: number;
  packaging?: number;
  commission?: number;
  /** Taxa (%) aplicada — geralmente pix ou cartão */
  feePct?: number;
  otherCosts?: number;
  /** Margem alvo (%) — se omitida, usa idealMargin da política */
  targetMargin?: number;
}

/** Resultado do cálculo */
export interface PricingResult {
  costTotal: number;
  feePct: number;
  /** Preço no mínimo aceitável (usa minMargin) */
  minPrice: number;
  /** Preço recomendado (usa idealMargin) */
  recommendedPrice: number;
  /** Preço premium (usa premiumMargin) */
  premiumPrice: number;
  /** Preço a partir da margem desejada (targetMargin) — pós arredondamento */
  targetPrice: number;
  profit: number;
  marginPct: number;
  markupPct: number;
}

export type PricingStatus = "premium" | "healthy" | "attention" | "below";

export interface PricingEvaluation {
  status: PricingStatus;
  label: string;
  marginPct: number;
  markupPct: number;
  profit: number;
  costTotal: number;
  feePct: number;
}
