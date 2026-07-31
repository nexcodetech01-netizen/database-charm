/**
 * Use Case — ApplySuggestedPrice
 * ==============================
 * NÃO atualiza produto (isso é responsabilidade do Product Domain).
 * Devolve um "command" com o preço a aplicar + snapshot para auditoria.
 *
 * O consumidor decide: (1) atualizar o preço do produto (Product Domain),
 * (2) opcionalmente chamar `RegisterPricingDecision` com o snapshot devolvido.
 */
import type { PricingContextBundle } from "../../resolver/pricing-context-factory";
import type { PricingDecisionSnapshot } from "../../persistence/types";
import type { PricingResult } from "../../engine/types";
import { invalidArgument } from "../errors";
import type { Actor, PricingApplicationDeps, UseCase } from "../ports";
import {
  createCalculateSuggestedPriceUseCase,
  type CalculateSuggestedPriceInput,
} from "./calculate-suggested-price";

export type PriceStrategy = "min" | "recommended" | "premium" | "target" | "final";

export interface ApplySuggestedPriceInput extends CalculateSuggestedPriceInput {
  readonly strategy?: PriceStrategy; // default: "final"
  readonly actor?: Actor;
}

export interface ApplyPriceCommand {
  readonly productId: string;
  readonly companyId: string;
  readonly priceCents: number;
  readonly currency: string;
  readonly strategy: PriceStrategy;
  readonly explainId: string;
  readonly requestId: string;
  readonly computedAt: string;
}

export interface ApplySuggestedPriceOutput {
  readonly command: ApplyPriceCommand;
  readonly result: PricingResult;
  readonly bundle: PricingContextBundle;
  /** Pronto para `RegisterPricingDecision.execute({ snapshot })`. */
  readonly snapshot: PricingDecisionSnapshot;
}

function pickPrice(result: PricingResult, strategy: PriceStrategy): number {
  switch (strategy) {
    case "min":
      return result.minPriceCents;
    case "recommended":
      return result.recommendedPriceCents;
    case "premium":
      return result.premiumPriceCents;
    case "target":
      return result.targetPriceCents;
    case "final":
    default:
      return result.finalPriceCents;
  }
}

export function createApplySuggestedPriceUseCase(
  deps: PricingApplicationDeps,
): UseCase<ApplySuggestedPriceInput, ApplySuggestedPriceOutput> {
  const calc = createCalculateSuggestedPriceUseCase(deps);
  return {
    async execute(input) {
      const strategy: PriceStrategy = input.strategy ?? "final";
      const { bundle, result } = await calc.execute(input);
      const priceCents = pickPrice(result, strategy);
      if (!Number.isFinite(priceCents) || priceCents < 0) {
        throw invalidArgument(`price for strategy '${strategy}' is invalid`);
      }

      const explanation = deps.engine.explain(result);
      const snapshot: PricingDecisionSnapshot = {
        companyId: input.companyId,
        requestId: result.requestId,
        explainId: result.explainId,
        engineVersion: result.engineVersion,
        calculationVersion: result.calculationVersion,
        contextVersion: result.contextVersion,
        resultVersion: result.resultVersion,
        policyVersion: result.policyVersion,
        snapshotHash: deps.hasher.hash({
          context: bundle.context,
          result,
        }),
        appliedRules: result.appliedRules,
        warnings: result.warnings,
        context: bundle.context,
        result,
        explanation,
        createdBy: input.actor?.userId,
      };

      const command: ApplyPriceCommand = {
        productId: input.productId,
        companyId: input.companyId,
        priceCents,
        currency: result.currency,
        strategy,
        explainId: result.explainId,
        requestId: result.requestId,
        computedAt: result.computedAt,
      };

      return { command, result, bundle, snapshot };
    },
  };
}
