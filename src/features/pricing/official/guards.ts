/**
 * FASE 7 — Proteções obrigatórias do Motor Comercial.
 * Puro, sem I/O. Consumido por PDV, cadastro, marketplace e Bella.
 */
import type { OfficialEvaluation } from "./official-pricing";

export type PriceGuardCode =
  | "BELOW_COST"
  | "BELOW_MIN_MARGIN"
  | "ABOVE_MAX_MARGIN"
  | "FEE_EATS_PROFIT";

export type PriceGuardSeverity = "block" | "warn";

export interface PriceGuard {
  code: PriceGuardCode;
  severity: PriceGuardSeverity;
  message: string;
}

export interface PriceGuardPolicy {
  minMarginPct: number;
  maxMarginPct?: number;
  /** Autorização explícita para vender abaixo do custo. */
  allowBelowCost?: boolean;
}

/**
 * Avalia um preço praticado contra as proteções comerciais.
 * `block` = venda impedida (salvo autorização). `warn` = apenas alerta.
 */
export function evaluatePriceGuards(
  price: number,
  evaluation: OfficialEvaluation,
  policy: PriceGuardPolicy,
): PriceGuard[] {
  const guards: PriceGuard[] = [];
  const fmt = (n: number) => n.toFixed(2);

  if (price > 0 && evaluation.profit < 0) {
    guards.push({
      code: "BELOW_COST",
      severity: policy.allowBelowCost ? "warn" : "block",
      message: `Preço abaixo do custo total (R$ ${fmt(evaluation.costTotal)}) — prejuízo de R$ ${fmt(Math.abs(evaluation.profit))}.`,
    });
  } else if (evaluation.marginPct < policy.minMarginPct) {
    guards.push({
      code: "BELOW_MIN_MARGIN",
      severity: "warn",
      message: `Margem de ${fmt(evaluation.marginPct)}% abaixo da mínima (${fmt(policy.minMarginPct)}%).`,
    });
  }

  if (
    typeof policy.maxMarginPct === "number" &&
    policy.maxMarginPct > 0 &&
    evaluation.marginPct > policy.maxMarginPct
  ) {
    guards.push({
      code: "ABOVE_MAX_MARGIN",
      severity: "warn",
      message: `Margem de ${fmt(evaluation.marginPct)}% acima do teto da categoria (${fmt(policy.maxMarginPct)}%).`,
    });
  }

  const feeAmount = (price * evaluation.feePct) / 100;
  if (price > 0 && feeAmount > 0 && evaluation.profit >= 0 && feeAmount >= evaluation.profit) {
    guards.push({
      code: "FEE_EATS_PROFIT",
      severity: "warn",
      message: `A taxa de recebimento (R$ ${fmt(feeAmount)}) consome todo o lucro (R$ ${fmt(evaluation.profit)}).`,
    });
  }

  return guards;
}

export const hasBlockingGuard = (guards: readonly PriceGuard[]): boolean =>
  guards.some((g) => g.severity === "block");
