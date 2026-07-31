/**
 * Bella Contadora — score de saúde (função pura e determinística).
 *
 * Não é regra financeira nova: apenas classifica indicadores já apurados
 * pelo motor contábil existente.
 */
import type { FinancialHealth, HealthLevel } from "../types";
import { clamp } from "./helpers";

export interface HealthInput {
  liquidity: number | null;
  workingCapital: number;
  debtRatio: number;
  netMargin: number;
}

export function levelFromScore(score: number): HealthLevel {
  if (score >= 70) return "healthy";
  if (score >= 40) return "attention";
  return "critical";
}

export function computeFinancialHealth(input: HealthInput): FinancialHealth {
  const reasons: string[] = [];
  let score = 100;

  if (input.liquidity == null) {
    reasons.push("Liquidez corrente indisponível.");
    score -= 10;
  } else if (input.liquidity < 1) {
    reasons.push("Liquidez corrente abaixo de 1,0.");
    score -= 30;
  }

  if (input.workingCapital < 0) {
    reasons.push("Capital de giro negativo.");
    score -= 25;
  }

  if (input.debtRatio > 60) {
    reasons.push("Endividamento acima de 60%.");
    score -= 20;
  }

  if (input.netMargin < 0) {
    reasons.push("Margem líquida negativa.");
    score -= 30;
  } else if (input.netMargin < 5) {
    reasons.push("Margem líquida abaixo de 5%.");
    score -= 10;
  }

  const finalScore = clamp(Math.round(score), 0, 100);
  return {
    level: levelFromScore(finalScore),
    score: finalScore,
    liquidity: input.liquidity,
    workingCapital: input.workingCapital,
    debtRatio: input.debtRatio,
    reasons,
  };
}
