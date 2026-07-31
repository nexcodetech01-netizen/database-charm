/**
 * Validação estrutural do PricingContext.
 * PRIVADO — retorna warnings, nunca lança para regras previsíveis.
 */
import type {
  MarginTargetSpec,
  PricingContext,
  PricingWarning,
  RoundingPolicySpec,
} from "../types";
import { isFiniteNumber } from "./math";

export interface ContextValidation {
  warnings: PricingWarning[];
  /** Contexto normalizado (com defaults aplicados a campos inválidos). */
  quantity: number;
  effectiveMarginTarget: MarginTargetSpec;
  effectiveRounding: RoundingPolicySpec;
}

const DEFAULT_MARGIN_TARGET: MarginTargetSpec = { kind: "ideal" };
const DEFAULT_ROUNDING: RoundingPolicySpec = { kind: "none" };

export function validateContext(ctx: PricingContext): ContextValidation {
  const warnings: PricingWarning[] = [];

  // Quantity
  let quantity = ctx.quantity;
  if (!isFiniteNumber(quantity) || quantity <= 0) {
    warnings.push({
      code: "INVALID_QUANTITY",
      message: `Quantity inválida (${String(ctx.quantity)}) — assumindo 1.`,
      detail: { received: ctx.quantity },
    });
    quantity = 1;
  }

  // CostComposition presença/negatividade
  if (!ctx.costComposition) {
    warnings.push({
      code: "MISSING_COST_COMPOSITION",
      message: "CostComposition ausente — custo assumido como 0.",
    });
  } else {
    if (
      !isFiniteNumber(ctx.costComposition.perUnitCostCents) ||
      ctx.costComposition.perUnitCostCents < 0
    ) {
      warnings.push({
        code: "NEGATIVE_COST",
        message: "perUnitCostCents inválido — clamp em 0.",
        detail: { received: ctx.costComposition.perUnitCostCents },
      });
    }
    // Stale check
    const threshold = ctx.costComposition.staleThresholdDays;
    if (
      isFiniteNumber(threshold) &&
      threshold > 0 &&
      typeof ctx.costComposition.computedAt === "string" &&
      typeof ctx.clock?.now === "string"
    ) {
      const computedAt = Date.parse(ctx.costComposition.computedAt);
      const now = Date.parse(ctx.clock.now);
      if (!Number.isNaN(computedAt) && !Number.isNaN(now)) {
        const days = (now - computedAt) / (1000 * 60 * 60 * 24);
        if (days > threshold) {
          warnings.push({
            code: "COST_STALE",
            message: `Custo estabilizado há ${Math.floor(days)}d (limite ${threshold}d).`,
            detail: { days, threshold },
          });
        }
      }
    }
  }

  // Margin target
  let effectiveMarginTarget = ctx.marginTarget ?? DEFAULT_MARGIN_TARGET;
  if (effectiveMarginTarget.kind === "custom") {
    const pct = effectiveMarginTarget.pct;
    if (!isFiniteNumber(pct) || pct < 0 || pct >= 100) {
      warnings.push({
        code: "INVALID_MARGIN_TARGET",
        message: `Margem customizada inválida (${String(pct)}%) — usando padrão ideal.`,
        detail: { received: pct },
      });
      effectiveMarginTarget = DEFAULT_MARGIN_TARGET;
    }
  }

  // Rounding policy
  let effectiveRounding = ctx.roundingPolicy ?? DEFAULT_ROUNDING;
  if (
    effectiveRounding.kind === "psychological" &&
    (!Array.isArray(effectiveRounding.endings) ||
      effectiveRounding.endings.length === 0)
  ) {
    warnings.push({
      code: "INVALID_ROUNDING_POLICY",
      message: "Endings vazios em psychological rounding — nenhum arredondamento aplicado.",
    });
    effectiveRounding = DEFAULT_ROUNDING;
  }

  // Channel não-linear
  if (ctx.channel?.hasNonLinearRules) {
    warnings.push({
      code: "NON_LINEAR_CHANNEL_RULE_IGNORED",
      message: "Regras não-lineares de canal ignoradas pelo Core (aplicar em Sales).",
      detail: { channelId: ctx.channel.channelId },
    });
  }

  // TaxQuote validade
  if (ctx.taxQuote) {
    const tq = ctx.taxQuote;
    const now = Date.parse(ctx.clock?.now ?? "");
    if (!Number.isNaN(now)) {
      const validTo = tq.validTo ? Date.parse(tq.validTo) : NaN;
      if (!Number.isNaN(validTo) && validTo < now) {
        warnings.push({
          code: "TAX_QUOTE_EXPIRED",
          message: `TaxQuote ${tq.quoteId} expirada.`,
          detail: { validTo: tq.validTo, now: ctx.clock.now },
        });
      }
    }
  }

  return {
    warnings,
    quantity,
    effectiveMarginTarget,
    effectiveRounding,
  };
}
