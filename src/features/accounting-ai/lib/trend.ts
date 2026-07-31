/**
 * Bella Contadora — comparação de tendência (função pura).
 *
 * NÃO é regra financeira nova: apenas compara dois números já apurados
 * pelos motores existentes e classifica a variação.
 */
import type { TrendComparison, TrendDirection } from "../types";

export const NO_HISTORY_LABEL = "sem histórico suficiente";

/** Variação considerada estabilidade (em pontos percentuais). */
const FLAT_TOLERANCE = 0.5;

function formatPercentSigned(value: number): string {
  const abs = Math.abs(value).toFixed(1).replace(".", ",");
  return `${abs}%`;
}

export function directionSymbol(direction: TrendDirection): string {
  if (direction === "up") return "↑";
  if (direction === "down") return "↓";
  if (direction === "flat") return "→";
  return "—";
}

/**
 * Compara período atual x período anterior.
 * `previous === null` significa que o motor não forneceu histórico.
 */
export function computeTrend(
  current: number,
  previous: number | null,
): TrendComparison {
  if (previous == null || !Number.isFinite(previous)) {
    return {
      current,
      previous: null,
      delta: null,
      deltaPercent: null,
      direction: "unknown",
      hasHistory: false,
      label: NO_HISTORY_LABEL,
    };
  }

  const delta = current - previous;

  if (previous === 0) {
    if (delta === 0) {
      return {
        current,
        previous,
        delta: 0,
        deltaPercent: 0,
        direction: "flat",
        hasHistory: true,
        label: "estável",
      };
    }
    const direction: TrendDirection = delta > 0 ? "up" : "down";
    return {
      current,
      previous,
      delta,
      deltaPercent: null,
      direction,
      hasHistory: true,
      label: delta > 0 ? "sem base anterior" : "sem base anterior",
    };
  }

  const deltaPercent = (delta / Math.abs(previous)) * 100;
  if (Math.abs(deltaPercent) < FLAT_TOLERANCE) {
    return {
      current,
      previous,
      delta,
      deltaPercent,
      direction: "flat",
      hasHistory: true,
      label: "estável",
    };
  }

  const direction: TrendDirection = deltaPercent > 0 ? "up" : "down";
  return {
    current,
    previous,
    delta,
    deltaPercent,
    direction,
    hasHistory: true,
    label: formatPercentSigned(deltaPercent),
  };
}
