/**
 * Bella Contadora — Proactive providers.
 *
 * Não busca dados: apenas normaliza as fontes já apuradas (summary,
 * insights, advisor, health) em um `ProactiveContext` determinístico.
 */
import { buildAccountingInsights } from "../insights";
import { buildFinancialAdvice } from "../advisor";
import type { ProactiveContext, ProactiveInput } from "./types";

/** Constrói o contexto do motor a partir das fontes existentes. */
export function buildProactiveContext(
  input: ProactiveInput,
  createdAt: string,
): ProactiveContext | null {
  const summary = input.summary ?? null;
  if (!summary) return null;

  const insights = input.insights ?? buildAccountingInsights(summary);
  const advice = input.advice ?? buildFinancialAdvice({ summary });
  const health = input.health ?? summary.health.data?.financial ?? null;

  return { summary, insights, advice, health, createdAt };
}

/** Lista dos providers indisponíveis no resumo (usado pela regra "sistema"). */
export function unavailableProviders(input: ProactiveInput): string[] {
  const summary = input.summary;
  if (!summary) return [];
  const entries: Array<[string, { available: boolean }]> = [
    ["receita", summary.revenue],
    ["lucro", summary.profit],
    ["despesas", summary.expenses],
    ["caixa", summary.cash],
    ["fluxo de caixa", summary.cashFlow],
    ["impostos", summary.taxes],
    ["estoque", summary.inventory],
    ["ticket médio", summary.ticket],
    ["margem", summary.margin],
    ["produtos", summary.products],
    ["clientes", summary.customers],
    ["pró-labore", summary.payroll],
    ["saúde", summary.health],
  ];
  return entries.filter(([, r]) => !r.available).map(([label]) => label);
}
