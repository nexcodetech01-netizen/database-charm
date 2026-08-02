/**
 * Pricing Engine — explain()
 * ==========================
 *
 * Recebe um PricingResult e devolve uma explicação estruturada.
 * NUNCA reconstrói o cálculo — apenas reprojeta as informações já presentes
 * no PricingResult (ADR-005).
 *
 * `summary` é texto livre — pode mudar entre versões.
 * `steps`  é contrato estável — espelha `appliedRules`.
 */
import {
  EXPLANATION_VERSION,
  type ExplanationStep,
  type InvariantCheck,
  type PricingExplanation,
  type PricingResult,
} from "./types";

function formatMoney(cents: number, currency: string): string {
  if (!Number.isFinite(cents)) return "—";
  const value = cents / 100;
  if (currency === "BRL") {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  }
  return `${currency} ${value.toFixed(2)}`;
}

export function explain(result: PricingResult): PricingExplanation {
  const steps: ExplanationStep[] = result.appliedRules.map((r) => ({
    step: r.step,
    rule: r.rule,
    source: r.source,
    inputCents: r.inputCents,
    outputCents: r.outputCents,
    detail: r.detail,
  }));

  const invariantsChecked: InvariantCheck[] = [];

  // Invariante 1 — preço final não-negativo.
  invariantsChecked.push({
    name: "final_price_non_negative",
    passed: result.finalPriceCents >= 0,
    detail: `finalPriceCents=${result.finalPriceCents}`,
  });

  // Invariante 2 — modo consistente com presença de pricelist.
  const hasPriceListStep = result.appliedRules.some(
    (r) => r.step === "pricelist" && r.rule === "pricelist:apply",
  );
  invariantsChecked.push({
    name: "mode_matches_pricelist_step",
    passed: (result.mode === "tabled") === hasPriceListStep,
    detail: `mode=${result.mode} pricelistStep=${hasPriceListStep}`,
  });

  // Invariante 3 — steps na ordem determinística.
  const canonicalOrder = [
    "cost",
    "target",
    "channel",
    "tax",
    "behavior",
    "pricelist",
    "rounding",
    "floor",
  ] as const;
  const orderIndex = (name: string) => {
    const idx = canonicalOrder.indexOf(name as (typeof canonicalOrder)[number]);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  };
  let orderOk = true;
  for (let i = 1; i < result.appliedRules.length; i++) {
    if (orderIndex(result.appliedRules[i]!.step) < orderIndex(result.appliedRules[i - 1]!.step)) {
      orderOk = false;
      break;
    }
  }
  invariantsChecked.push({
    name: "steps_in_canonical_order",
    passed: orderOk,
  });

  // Invariante 4 — versionamento presente.
  invariantsChecked.push({
    name: "versioning_present",
    passed:
      Boolean(result.engineVersion) &&
      Boolean(result.calculationVersion) &&
      Boolean(result.policyVersion),
  });

  const suggested: string[] = [];
  for (const w of result.warnings) {
    switch (w.code) {
      case "MARGIN_BELOW_MIN":
        suggested.push("Aumentar preço para respeitar minMargin.");
        break;
      case "MARGIN_BELOW_IDEAL":
        suggested.push("Revisar composição de custo ou canal para atingir idealMargin.");
        break;
      case "COST_STALE":
        suggested.push("Recomputar CostComposition (Inventory).");
        break;
      case "TAX_QUOTE_EXPIRED":
        suggested.push("Solicitar nova cotação ao Tax Engine.");
        break;
      case "TABLED_PRICE_BELOW_FLOOR":
        suggested.push("Reavaliar entrada da PriceList — piso violado.");
        break;
      default:
        break;
    }
  }

  const summary = [
    `${formatMoney(result.finalPriceCents, result.currency)}`,
    `(modo ${result.mode}, custo ${formatMoney(result.costTotalCents, result.currency)},`,
    `margem ${result.marginPct.toFixed(1)}%, markup ${result.markupPct.toFixed(1)}%)`,
  ].join(" ");

  return {
    explanationVersion: EXPLANATION_VERSION,
    explainId: result.explainId,
    requestId: result.requestId,
    engineVersion: result.engineVersion,
    calculationVersion: result.calculationVersion,
    policyVersion: result.policyVersion,
    mode: result.mode,
    summary,
    steps,
    policyResolutionTree: result.policySource,
    invariantsChecked,
    warnings: result.warnings,
    suggestedActions: suggested.length > 0 ? suggested : undefined,
  };
}
