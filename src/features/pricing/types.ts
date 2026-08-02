/**
 * Inteligência de Precificação — tipos de POLÍTICA (configuração).
 *
 * Este arquivo NÃO contém contrato de cálculo. Resultado, avaliação e
 * status vêm exclusivamente de `@/features/pricing/official`.
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

/** Converte o modo de arredondamento da política para o contrato do motor. */
export function toRoundingPolicySpec(mode: RoundingMode) {
  switch (mode) {
    case "integer":
      return { kind: "integer" } as const;
    case "end_90":
      return { kind: "end_90" } as const;
    case "end_99":
      return { kind: "end_99" } as const;
    default:
      return { kind: "none" } as const;
  }
}
