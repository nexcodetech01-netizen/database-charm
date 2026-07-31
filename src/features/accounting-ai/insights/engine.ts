/**
 * Bella Contadora — Insight Engine (puro).
 *
 * Entrada: apenas o `AccountingSummary` devolvido pelos providers.
 * Saída: `AccountingInsight[]` já ordenado (critical → warning → success → info).
 *
 * Sem React, sem Supabase, sem IO, sem efeitos colaterais. Um provider
 * indisponível simplesmente não gera insights daquela categoria.
 */
import type { AccountingSummary } from "../types";
import { INSIGHT_RULES, type RuleContext } from "./rules";
import {
  filterAlerts,
  groupInsights,
  sortInsights,
} from "./helpers";
import type {
  AccountingInsight,
  InsightEngineOptions,
  InsightGroup,
} from "./types";

export function buildAccountingInsights(
  summary: AccountingSummary | undefined | null,
  options: InsightEngineOptions = {},
): AccountingInsight[] {
  if (!summary) return [];
  const createdAt = (options.now ?? new Date()).toISOString();
  const ctx: RuleContext = { summary, options, createdAt };

  const out: AccountingInsight[] = [];
  const seen = new Set<string>();
  for (const rule of INSIGHT_RULES) {
    const insight = rule(ctx);
    if (!insight || seen.has(insight.id)) continue;
    seen.add(insight.id);
    out.push(insight);
  }
  return sortInsights(out);
}

/** Somente insights acionáveis (critical + warning). */
export function buildAccountingAlerts(
  summary: AccountingSummary | undefined | null,
  options: InsightEngineOptions = {},
): AccountingInsight[] {
  return filterAlerts(buildAccountingInsights(summary, options));
}

/** Insights agrupados por categoria. */
export function buildAccountingInsightGroups(
  summary: AccountingSummary | undefined | null,
  options: InsightEngineOptions = {},
): InsightGroup[] {
  return groupInsights(buildAccountingInsights(summary, options));
}

/** Recomendações únicas, na ordem de prioridade dos insights. */
export function buildAccountingRecommendations(
  summary: AccountingSummary | undefined | null,
  options: InsightEngineOptions = {},
): { id: string; action: AccountingInsight["action"]; recommendation: string }[] {
  return buildAccountingInsights(summary, options).map((i) => ({
    id: i.id,
    action: i.action,
    recommendation: i.recommendation,
  }));
}
