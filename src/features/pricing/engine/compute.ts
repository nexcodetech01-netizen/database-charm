/**
 * Pricing Engine — compute()
 * ==========================
 *
 * API pública única do Core Engine (junto com `explain()`).
 * Motor PURO: sem I/O, sem clock ambiente, sem random.
 * Todo contexto já chega resolvido no PricingContext.
 *
 * Cadeia canônica (§25, ADR-005):
 *   cost → target → channel → tax → behavior → pricelist → rounding → floor
 *
 * COMPOSIÇÃO DE CUSTO — FONTE ÚNICA DE VERDADE
 * --------------------------------------------
 * Se o consumidor forneceu qualquer componente de custo
 * (acquisitionCostCents, freightCents, packagingCents, insuranceCents,
 * otherExpensesCents), o engine DERIVA `perUnitCostCents` a partir da soma
 * canônica em `sumCostComponentsCents()`. Qualquer valor pré-computado
 * divergente é ignorado e gera warning `COST_COMPONENTS_MISMATCH`.
 * Nenhum outro módulo pode somar componentes de custo por conta própria.
 */
import {
  CALCULATION_VERSION,
  CONTEXT_VERSION,
  ENGINE_VERSION,
  RESULT_VERSION,
  type AppliedRule,
  type MarginTargetSpec,
  type PolicySource,
  type PricingContext,
  type PricingMode,
  type PricingResult,
  type PricingWarning,
} from "./types";
import { atLeast, isFiniteNumber, stableHash, stableStringify, toCents } from "./internal/math";
import { applyRounding } from "./internal/rounding";
import { validateContext } from "./internal/validators";
import { sumCostComponentsCents } from "./internal/cost";

// -----------------------------------------------------------------------------

/** Resolve o percentual efetivo do MarginTargetSpec usando defaults da company. */
function resolveMarginPct(
  target: MarginTargetSpec,
  company: PricingContext["company"],
): { pct: number; source: string; rule: string } {
  const d = company.defaults ?? {};
  switch (target.kind) {
    case "min":
      return {
        pct: d.minMarginPct ?? 0,
        source: "company.defaults.minMarginPct",
        rule: "target:min",
      };
    case "ideal":
      return {
        pct: d.idealMarginPct ?? 0,
        source: "company.defaults.idealMarginPct",
        rule: "target:ideal",
      };
    case "premium":
      return {
        pct: d.premiumMarginPct ?? 0,
        source: "company.defaults.premiumMarginPct",
        rule: "target:premium",
      };
    case "custom":
      return {
        pct: target.pct,
        source: "context.marginTarget.custom",
        rule: "target:custom",
      };
  }
}

/**
 * Preço necessário para atingir uma margem-alvo (%) sobre o PREÇO FINAL,
 * já descontando taxa variável (%) e imposto (%). Fórmula:
 *   price = (cost + fixed) / (1 - (margin + fee + tax) / 100)
 *
 * Retorna Infinity se denominador ≤ 0 (situação impossível — emite warning).
 */
function priceForMargin(
  costCents: number,
  fixedAddCents: number,
  marginPct: number,
  feePct: number,
  taxPct: number,
): number {
  const denomPct = 100 - marginPct - feePct - taxPct;
  if (denomPct <= 0) return Infinity;
  const numerator = costCents + fixedAddCents;
  if (numerator <= 0) return 0;
  return numerator / (denomPct / 100);
}

// -----------------------------------------------------------------------------

/**
 * Calcula o preço a partir de um PricingContext totalmente resolvido.
 * NUNCA lança para regras de negócio previsíveis — usa warnings.
 */
export function compute(ctx: PricingContext): PricingResult {
  const warnings: PricingWarning[] = [];
  const appliedRules: AppliedRule[] = [];
  const policySource: Record<string, string> = {};

  // ─── Validação estrutural ─────────────────────────────────────────────────
  const validation = validateContext(ctx);
  warnings.push(...validation.warnings);

  const quantity = validation.quantity;
  const marginTarget = validation.effectiveMarginTarget;
  const roundingPolicy = validation.effectiveRounding;

  // ─── Step: COST ───────────────────────────────────────────────────────────
  // Composição canônica (fonte única): se qualquer componente estiver
  // presente, o engine deriva `perUnitCostCents` da soma e ignora o valor
  // declarado; divergência emite warning `COST_COMPONENTS_MISMATCH`.
  const cc = ctx.costComposition;
  const hasComponents =
    !!cc &&
    (cc.acquisitionCostCents !== undefined ||
      cc.freightCents !== undefined ||
      cc.packagingCents !== undefined ||
      cc.insuranceCents !== undefined ||
      cc.otherExpensesCents !== undefined);
  const declaredCost = cc?.perUnitCostCents;
  let costCents = 0;
  if (hasComponents && cc) {
    const derived = sumCostComponentsCents({
      acquisitionCostCents: cc.acquisitionCostCents ?? 0,
      freightCents: cc.freightCents,
      packagingCents: cc.packagingCents,
      insuranceCents: cc.insuranceCents,
      otherExpensesCents: cc.otherExpensesCents,
    });
    costCents = derived;
    if (isFiniteNumber(declaredCost) && atLeast(declaredCost, 0) !== derived) {
      warnings.push({
        code: "COST_COMPONENTS_MISMATCH",
        message: `perUnitCostCents declarado (${declaredCost}) diverge da soma canônica dos componentes (${derived}); engine usou a soma.`,
        step: "cost",
        detail: { declared: declaredCost, derived },
      });
    }
  } else {
    costCents = isFiniteNumber(declaredCost) ? atLeast(declaredCost, 0) : 0;
  }

  const opCostCents = ctx.channel ? atLeast(ctx.channel.operationalCostCents, 0) : 0;
  const fixedFeeCents = ctx.channel
    ? Math.round(atLeast(ctx.channel.fixedFeePerOrderCents, 0) / quantity)
    : 0;
  const taxFixedCents = ctx.taxQuote ? atLeast(ctx.taxQuote.totalFixedCents, 0) : 0;
  
  // LÓGICA RÍGIDA: Custos fixos por unidade que compõem o Custo Total Efetivo
  const fixedAddCents = opCostCents + fixedFeeCents + taxFixedCents;
  const costTotalCents = costCents + fixedAddCents;

  appliedRules.push({
    step: "cost",
    rule: "cost:compose",
    outputCents: costTotalCents,
    source: "costComposition",
    detail: {
      perUnitCostCents: costCents,
      operationalCostCents: opCostCents,
      fixedFeePerOrderCents: fixedFeeCents,
      taxFixedCents,
      quantity,
    },
  });
  policySource.perUnitCost = ctx.costComposition?.origin === "manual" ? "manual" : "inventory";

  // ─── Step: TARGET (margem-alvo) ──────────────────────────────────────────
  const resolvedTarget = resolveMarginPct(marginTarget, ctx.company);
  appliedRules.push({
    step: "target",
    rule: resolvedTarget.rule,
    source: resolvedTarget.source,
    detail: { pct: resolvedTarget.pct },
  });
  policySource.marginTarget = resolvedTarget.source;

  const defaults = ctx.company.defaults ?? {};
  const minMarginPct = isFiniteNumber(defaults.minMarginPct) ? defaults.minMarginPct : 0;
  const idealMarginPct = isFiniteNumber(defaults.idealMarginPct)
    ? defaults.idealMarginPct
    : resolvedTarget.pct;
  const premiumMarginPct = isFiniteNumber(defaults.premiumMarginPct)
    ? defaults.premiumMarginPct
    : Math.max(idealMarginPct, resolvedTarget.pct);

  // ─── Step: CHANNEL (fee %) ───────────────────────────────────────────────
  const feePct = ctx.channel ? atLeast(ctx.channel.variableFeePct, 0) : 0;
  appliedRules.push({
    step: "channel",
    rule: ctx.channel ? "channel:apply" : "channel:none",
    source: ctx.channel ? `channel:${ctx.channel.channelId}` : "system",
    detail: { variableFeePct: feePct, fixedFeePerOrderCents: fixedFeeCents },
  });
  policySource.channelFee = ctx.channel ? "channel" : "system";

  // ─── Step: TAX (%) ───────────────────────────────────────────────────────
  const taxPct = ctx.taxQuote ? atLeast(ctx.taxQuote.totalPctOnPrice, 0) : 0;
  appliedRules.push({
    step: "tax",
    rule: ctx.taxQuote ? "tax:apply" : "tax:none",
    source: ctx.taxQuote ? `taxQuote:${ctx.taxQuote.quoteId}` : "system",
    detail: { totalPctOnPrice: taxPct, totalFixedCents: taxFixedCents },
  });
  policySource.taxPct = ctx.taxQuote ? "taxQuote" : "system";

  // ─── Pontos de preço derivados ───────────────────────────────────────────
  const rawMin = priceForMargin(costCents, fixedAddCents, minMarginPct, feePct, taxPct);
  const rawIdeal = priceForMargin(costCents, fixedAddCents, idealMarginPct, feePct, taxPct);
  const rawPremium = priceForMargin(costCents, fixedAddCents, premiumMarginPct, feePct, taxPct);
  const rawTarget = priceForMargin(costCents, fixedAddCents, resolvedTarget.pct, feePct, taxPct);

  const anyImpossible = [rawMin, rawIdeal, rawPremium, rawTarget].some((v) => !Number.isFinite(v));
  if (anyImpossible) {
    warnings.push({
      code: "DIVISION_BY_ZERO_AVOIDED",
      message:
        "Soma de margem+fee+tax ≥ 100% em pelo menos um ponto de preço. Preços impossíveis foram zerados.",
      step: "target",
    });
  }

  const finiteOrZero = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);
  let minPriceCents = toCents(finiteOrZero(rawMin));
  let recommendedPriceCents = toCents(finiteOrZero(rawIdeal));
  let premiumPriceCents = toCents(finiteOrZero(rawPremium));
  let targetPriceCents = toCents(finiteOrZero(rawTarget));

  // ─── Step: BEHAVIOR ──────────────────────────────────────────────────────
  const behavior = ctx.commercialBehavior;
  let behaviorRule = "behavior:standard";
  let discountPct = 0;
  if (behavior) {
    switch (behavior.kind) {
      case "standard":
        behaviorRule = "behavior:standard";
        break;
      case "high_turnover":
        discountPct = atLeast(behavior.discountPct ?? 0, 0);
        behaviorRule = "behavior:high_turnover";
        break;
      case "promotion":
        discountPct = atLeast(behavior.discountPct, 0);
        behaviorRule = "behavior:promotion";
        break;
      case "stock_burn":
        discountPct = atLeast(behavior.maxDiscountPct, 0);
        behaviorRule = "behavior:stock_burn";
        break;
    }
  }
  if (discountPct >= 100) discountPct = 100;

  const preBehaviorTarget = targetPriceCents;
  if (discountPct > 0) {
    targetPriceCents = toCents(targetPriceCents * (1 - discountPct / 100));
  }
  appliedRules.push({
    step: "behavior",
    rule: behaviorRule,
    inputCents: preBehaviorTarget,
    outputCents: targetPriceCents,
    source: "context.commercialBehavior",
    detail: { discountPct },
  });
  policySource.commercialBehavior = "context";

  // ─── Step: PRICELIST (modo tabelado — §23) ───────────────────────────────
  let mode: PricingMode = "derived";
  let priceListApplicable = false;
  if (ctx.priceList) {
    const pl = ctx.priceList;
    const qtyOk =
      (!isFiniteNumber(pl.minQty) || quantity >= pl.minQty) &&
      (!isFiniteNumber(pl.maxQty) || quantity <= pl.maxQty);
    const currencyOk = pl.currency === ctx.currency;
    priceListApplicable = qtyOk && currencyOk;

    if (priceListApplicable) {
      mode = "tabled";
      const tabledPriceCents = toCents(atLeast(pl.priceCents, 0));
      appliedRules.push({
        step: "pricelist",
        rule: "pricelist:apply",
        inputCents: targetPriceCents,
        outputCents: tabledPriceCents,
        source: `priceList:${pl.priceListId}`,
        detail: { priceListId: pl.priceListId, priority: pl.priority ?? 0 },
      });
      targetPriceCents = tabledPriceCents;
      policySource.finalPrice = `priceList:${pl.priceListId}`;
    } else if (pl.fallback === "reject") {
      warnings.push({
        code: "PRICE_LIST_FALLBACK_APPLIED",
        message: `PriceList ${pl.priceListId} não aplicável e fallback=reject — preço derivado usado.`,
        step: "pricelist",
      });
      appliedRules.push({
        step: "pricelist",
        rule: "pricelist:not_applicable",
        source: `priceList:${pl.priceListId}`,
        detail: { reason: qtyOk ? "currency_mismatch" : "quantity_out_of_range" },
      });
    } else {
      appliedRules.push({
        step: "pricelist",
        rule: "pricelist:fallback_derived",
        source: `priceList:${pl.priceListId}`,
        detail: { reason: qtyOk ? "currency_mismatch" : "quantity_out_of_range" },
      });
    }
  }

  // ─── Step: ROUNDING ──────────────────────────────────────────────────────
  const beforeRounding = targetPriceCents;
  const rounded = applyRounding(targetPriceCents, roundingPolicy);
  targetPriceCents = rounded.valueCents;
  appliedRules.push({
    step: "rounding",
    rule: rounded.rule,
    inputCents: beforeRounding,
    outputCents: targetPriceCents,
    source: "context.roundingPolicy",
  });
  policySource.roundingPolicy = "context";

  // Arredonda também os pontos de referência (mesma política).
  minPriceCents = applyRounding(minPriceCents, roundingPolicy).valueCents;
  recommendedPriceCents = applyRounding(recommendedPriceCents, roundingPolicy).valueCents;
  premiumPriceCents = applyRounding(premiumPriceCents, roundingPolicy).valueCents;

  // ─── Step: FLOOR ─────────────────────────────────────────────────────────
  const productFloor = ctx.product.priceFloorCents;
  const channelMinMargin = ctx.channel?.minMarginOverridePct;
  const effectiveMinMarginPct = isFiniteNumber(channelMinMargin) ? channelMinMargin : minMarginPct;

  const marginFloorPriceRaw = priceForMargin(
    costCents,
    fixedAddCents,
    effectiveMinMarginPct,
    feePct,
    taxPct,
  );
  const marginFloorCents = Number.isFinite(marginFloorPriceRaw)
    ? toCents(finiteOrZero(marginFloorPriceRaw))
    : 0;

  const floorCandidates: number[] = [];
  if (isFiniteNumber(productFloor) && productFloor > 0) floorCandidates.push(productFloor);
  if (marginFloorCents > 0 && mode === "derived") floorCandidates.push(marginFloorCents);

  const priceFloorCents = floorCandidates.length > 0 ? Math.max(...floorCandidates) : 0;

  const beforeFloor = targetPriceCents;
  let finalPriceCents = targetPriceCents;
  if (finalPriceCents < 0) {
    warnings.push({
      code: "NEGATIVE_PRICE_CLAMPED",
      message: "Preço final negativo — clamp em 0.",
      step: "floor",
    });
    finalPriceCents = 0;
  }
  if (mode === "tabled" && finalPriceCents < priceFloorCents && priceFloorCents > 0) {
    warnings.push({
      code: "TABLED_PRICE_BELOW_FLOOR",
      message: "Preço tabelado abaixo do piso — Core não sobrescreve (respeita contrato humano).",
      step: "floor",
      detail: { priceCents: finalPriceCents, floorCents: priceFloorCents },
    });
  } else if (finalPriceCents < priceFloorCents) {
    finalPriceCents = priceFloorCents;
  }

  appliedRules.push({
    step: "floor",
    rule: mode === "tabled" ? "floor:tabled_advisory" : "floor:apply",
    inputCents: beforeFloor,
    outputCents: finalPriceCents,
    source: floorCandidates.length > 0 ? "policy+product" : "system",
    detail: { priceFloorCents, mode },
  });
  policySource.priceFloor = floorCandidates.length > 0 ? "policy+product" : "system";

  // ─── Indicadores ─────────────────────────────────────────────────────────
  const netFactor = 1 - feePct / 100 - taxPct / 100;
  const netFinalCents = finalPriceCents * (netFactor > 0 ? netFactor : 0) - fixedAddCents;
  const netProfitCents = toCents(netFinalCents - costCents);
  const grossProfitCents = toCents(finalPriceCents - costTotalCents);
  
  // LÓGICA RÍGIDA (§22): Margem sobre Venda e Markup sobre Custo Total Efetivo
  const marginPct = finalPriceCents > 0 ? (netProfitCents / finalPriceCents) * 100 : 0;
  const markupPct = costTotalCents > 0 ? (netProfitCents / costTotalCents) * 100 : 0;

  if (marginPct < minMarginPct) {
    warnings.push({
      code: "MARGIN_BELOW_MIN",
      message: `Margem líquida ${marginPct.toFixed(2)}% abaixo do mínimo ${minMarginPct}%.`,
      step: "floor",
    });
  } else if (marginPct < idealMarginPct) {
    warnings.push({
      code: "MARGIN_BELOW_IDEAL",
      message: `Margem líquida ${marginPct.toFixed(2)}% abaixo do ideal ${idealMarginPct}%.`,
    });
  }

  // ─── Hash de política e IDs de rastreio ──────────────────────────────────
  const policyPayload = stableStringify({
    company: ctx.company,
    category: ctx.category,
    product: {
      id: ctx.product.id,
      priceFloorCents: ctx.product.priceFloorCents,
    },
    channel: ctx.channel,
    marginTarget,
    commercialBehavior: ctx.commercialBehavior,
    roundingPolicy,
    priceList: ctx.priceList,
    taxQuote: ctx.taxQuote
      ? {
          quoteId: ctx.taxQuote.quoteId,
          taxEngineVersion: ctx.taxQuote.taxEngineVersion,
        }
      : undefined,
    currency: ctx.currency,
  });
  const policyVersion = `policy/${stableHash(policyPayload)}`;

  const explainId = `expl_${stableHash(`${ctx.requestId}|${policyVersion}|${finalPriceCents}`)}`;

  const result: PricingResult = {
    resultVersion: RESULT_VERSION,
    mode,
    minPriceCents,
    recommendedPriceCents,
    premiumPriceCents,
    targetPriceCents,
    finalPriceCents,
    costTotalCents,
    grossProfitCents,
    netProfitCents,
    marginPct,
    markupPct,
    appliedRules,
    policySource,
    engineVersion: ENGINE_VERSION,
    calculationVersion: CALCULATION_VERSION,
    policyVersion,
    contextVersion: CONTEXT_VERSION,
    taxEngineVersion: ctx.taxQuote?.taxEngineVersion,
    requestId: ctx.requestId,
    explainId,
    computedAt: ctx.clock.now,
    currency: ctx.currency,
    warnings,
  };

  return result;
}
