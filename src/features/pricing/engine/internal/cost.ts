/**
 * Pricing Engine — Cost Composition (fonte única de verdade)
 * ==========================================================
 *
 * A soma dos componentes de custo de um produto acontece EXCLUSIVAMENTE
 * aqui. Nenhum consumidor do Pricing (Cadastro, Simulador, Produtos,
 * Marketplace, Bella, Catálogo, Dashboard) tem permissão para somar
 * `cost + freight + packaging + insurance + others` por conta própria.
 *
 * Todos devem chamar `composeCostComposition(...)` para obter uma
 * `CostComposition.v1` válida, com `perUnitCostCents` derivado.
 *
 * PURO — sem I/O, sem clock ambiente.
 */
import { COST_COMPOSITION_VERSION, type CostComposition } from "../types";

export interface CostComponentsInputCents {
  /** Custo de aquisição do produto, em centavos. Componente obrigatório. */
  readonly acquisitionCostCents: number;
  readonly freightCents?: number;
  readonly packagingCents?: number;
  readonly insuranceCents?: number;
  readonly otherExpensesCents?: number;
  /** ISO-8601 do momento em que o custo foi estabilizado. */
  readonly computedAt: string;
  readonly staleThresholdDays?: number;
  readonly origin?: CostComposition["origin"];
  readonly weightedAverageCostCents?: number;
}

const nonNegInt = (v: number | undefined): number => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
};

/**
 * Soma canônica: custo + frete + embalagem + seguro + outras despesas.
 * Retorna valor em centavos, sempre inteiro e ≥ 0.
 *
 * ESTA é a única fórmula autorizada de composição de custo no NexOS.
 * Qualquer duplicação em outros módulos é bug arquitetural.
 */
export function sumCostComponentsCents(
  input: Pick<
    CostComponentsInputCents,
    | "acquisitionCostCents"
    | "freightCents"
    | "packagingCents"
    | "insuranceCents"
    | "otherExpensesCents"
  >,
): number {
  return (
    nonNegInt(input.acquisitionCostCents) +
    nonNegInt(input.freightCents) +
    nonNegInt(input.packagingCents) +
    nonNegInt(input.insuranceCents) +
    nonNegInt(input.otherExpensesCents)
  );
}

/**
 * Cria uma `CostComposition.v1` a partir dos componentes brutos.
 * `perUnitCostCents` é DERIVADO — nunca aceito de fora.
 */
export function composeCostComposition(input: CostComponentsInputCents): CostComposition {
  const perUnitCostCents = sumCostComponentsCents(input);
  return {
    version: COST_COMPOSITION_VERSION,
    perUnitCostCents,
    acquisitionCostCents: nonNegInt(input.acquisitionCostCents),
    freightCents: nonNegInt(input.freightCents),
    packagingCents: nonNegInt(input.packagingCents),
    insuranceCents: nonNegInt(input.insuranceCents),
    otherExpensesCents: nonNegInt(input.otherExpensesCents),
    weightedAverageCostCents: input.weightedAverageCostCents,
    computedAt: input.computedAt,
    staleThresholdDays: input.staleThresholdDays,
    origin: input.origin,
  };
}
