/**
 * Bella Contadora — helpers puros do Insight Engine.
 *
 * Sem IO, sem React, sem banco. Apenas classificação/ordenação de
 * números já apurados pelos motores existentes.
 */
import { computeTrend } from "../lib/trend";
import type { TrendComparison } from "../types";
import type {
  AccountingInsight,
  InsightCategory,
  InsightGroup,
  InsightSeverity,
} from "./types";

/** Texto único usado sempre que não há base de comparação. */
export const INSUFFICIENT_HISTORY = "Histórico insuficiente.";

/** Ordem oficial de severidade: critical → warning → success → info. */
export const SEVERITY_ORDER: InsightSeverity[] = [
  "critical",
  "warning",
  "success",
  "info",
];

/** Ordem estável das categorias para agrupamento. */
export const CATEGORY_ORDER: InsightCategory[] = [
  "receita",
  "lucro",
  "caixa",
  "financeiro",
  "estoque",
  "produtos",
  "clientes",
  "fiscal",
];

const SEVERITY_BASE: Record<InsightSeverity, number> = {
  critical: 90,
  warning: 70,
  success: 40,
  info: 20,
};

/** Peso numérico da severidade (menor = mais urgente). */
export function severityRank(severity: InsightSeverity): number {
  const idx = SEVERITY_ORDER.indexOf(severity);
  return idx === -1 ? SEVERITY_ORDER.length : idx;
}

/**
 * Score de magnitude (0–10) de uma variação percentual.
 * 0% → 0; ≥ 50% → 10. Monotônico e determinístico.
 */
export function magnitudeScore(percent: number | null | undefined): number {
  if (percent == null || !Number.isFinite(percent)) return 0;
  const abs = Math.abs(percent);
  return Math.round(Math.min(abs, 50) / 5);
}

/**
 * Prioridade final do insight: base da severidade + magnitude (0–10).
 * Sempre limitada a 0–100.
 */
export function computePriority(
  severity: InsightSeverity,
  magnitudePercent?: number | null,
): number {
  const base = SEVERITY_BASE[severity];
  const bonus = magnitudeScore(magnitudePercent);
  return Math.max(0, Math.min(100, base + bonus));
}

/** Reexporta a comparação de tendência já existente (fonte única). */
export function trendOf(
  current: number,
  previous: number | null,
): TrendComparison {
  return computeTrend(current, previous);
}

/**
 * Ordena por severidade → prioridade (desc) → id (estável e determinístico).
 * Não muta o array recebido.
 */
export function sortInsights(insights: readonly AccountingInsight[]): AccountingInsight[] {
  return [...insights].sort((a, b) => {
    const bySeverity = severityRank(a.severity) - severityRank(b.severity);
    if (bySeverity !== 0) return bySeverity;
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.id.localeCompare(b.id);
  });
}

/** Agrupa por categoria respeitando `CATEGORY_ORDER`; grupos vazios são omitidos. */
export function groupInsights(
  insights: readonly AccountingInsight[],
): InsightGroup[] {
  const groups: InsightGroup[] = [];
  for (const category of CATEGORY_ORDER) {
    const list = sortInsights(insights.filter((i) => i.category === category));
    if (list.length > 0) groups.push({ category, insights: list });
  }
  return groups;
}

/** Apenas os insights acionáveis (critical + warning). */
export function filterAlerts(
  insights: readonly AccountingInsight[],
): AccountingInsight[] {
  return sortInsights(
    insights.filter((i) => i.severity === "critical" || i.severity === "warning"),
  );
}

/** Percentual formatado em pt-BR sem sinal (ex.: "14,0%"). */
export function formatPercent(value: number): string {
  return `${Math.abs(value).toFixed(1).replace(".", ",")}%`;
}

/** Rótulo humano da categoria. */
export function categoryLabel(category: InsightCategory): string {
  const labels: Record<InsightCategory, string> = {
    receita: "Receita",
    lucro: "Lucro",
    caixa: "Caixa",
    financeiro: "Financeiro",
    estoque: "Estoque",
    produtos: "Produtos",
    clientes: "Clientes",
    fiscal: "Fiscal",
  };
  return labels[category];
}

/** Rótulo humano da severidade. */
export function severityLabel(severity: InsightSeverity): string {
  const labels: Record<InsightSeverity, string> = {
    critical: "Crítico",
    warning: "Atenção",
    success: "Positivo",
    info: "Informativo",
  };
  return labels[severity];
}
