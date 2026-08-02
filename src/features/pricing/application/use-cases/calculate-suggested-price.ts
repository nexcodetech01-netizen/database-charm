/**
 * Use Case — CalculateSuggestedPrice
 * ==================================
 * Resolve políticas + monta contexto + executa o Core. Nada é persistido
 * automaticamente. Para registrar auditoria, chame `RegisterPricingDecision`
 * com o `PricingResult` retornado.
 */
import type { PricingResult } from "../../engine/types";
import type { PricingContextBundle } from "../../resolver/pricing-context-factory";
import type { PricingApplicationDeps, UseCase } from "../ports";
import { createResolvePricingUseCase, type ResolvePricingInput } from "./resolve-pricing";

export type CalculateSuggestedPriceInput = ResolvePricingInput;

export interface CalculateSuggestedPriceOutput {
  readonly bundle: PricingContextBundle;
  readonly result: PricingResult;
}

export function createCalculateSuggestedPriceUseCase(
  deps: PricingApplicationDeps,
): UseCase<CalculateSuggestedPriceInput, CalculateSuggestedPriceOutput> {
  const resolve = createResolvePricingUseCase(deps);
  return {
    async execute(input) {
      const bundle = await resolve.execute(input);
      const result = deps.engine.compute(bundle.context);
      return { bundle, result };
    },
  };
}
