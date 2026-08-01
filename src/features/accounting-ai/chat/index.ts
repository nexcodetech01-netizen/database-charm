/**
 * Bella Contadora — Chat (Sprint 5.4).
 *
 * Fluxo: pergunta → IntentEngine → Planner → Router (skills existentes)
 * → ResponseBuilder → resposta em linguagem natural.
 *
 * Nenhum cálculo financeiro novo. Nenhuma IA generativa. Somente leitura.
 */
import type { ProviderDeps } from "../providers";
import { buildAccountingSummary } from "../providers/summary";
import { taxRegimeProvider } from "../tax/provider";
import { detectIntent } from "./intent-engine";
import { planIntent } from "./planner";
import { executePlan } from "./router";
import { buildAnswer } from "./response-builder";
import type { ChatAnswer, ChatContextState } from "./types";

export * from "./types";
export * from "./intent-engine";
export * from "./planner";
export * from "./router";
export * from "./response-builder";
export * from "./context";
export * from "./history";

export interface AskBellaOptions {
  context?: ChatContextState | null;
  deps?: ProviderDeps;
}

/**
 * Sprint 6.1.6 — P1: o resumo consolidado é agregado UMA única vez por
 * pergunta e injetado em `ProviderDeps`. Todas as skills do plano leem
 * exatamente o mesmo `AccountingSummary`; nenhuma reconstrói a agregação.
 */
export async function askBella(
  question: string,
  companyId: string,
  options: AskBellaOptions = {},
): Promise<ChatAnswer> {
  const match = detectIntent(question, { context: options.context ?? null });
  const plan = planIntent(match);
  if (plan.shape === "none") return buildAnswer(plan, []);

  const baseDeps = options.deps;
  const summary = baseDeps?.summary ?? (await buildAccountingSummary(companyId, baseDeps));
  const simulation =
    plan.intent === "simular_das" || plan.intent === "simular_faturamento"
      ? {
          growthPct: plan.growthPct ?? null,
          targetRevenue: plan.growthPct == null ? plan.amount : null,
        }
      : (baseDeps?.simulation ?? null);

  const deps: ProviderDeps = {
    ...baseDeps,
    summary,
    period: summary.period,
    simulation,
  };

  // Sprint 7.1 — o retrato tributário é lido UMA vez por pergunta e
  // compartilhado entre as skills do plano (nenhum recálculo, nenhum
  // segundo motor).
  const TAX_SKILLS = new Set([
    "consultar_das",
    "consultar_rbt12",
    "consultar_anexo",
    "consultar_aliquota",
    "consultar_faixa",
    "consultar_vencimento_das",
  ]);
  if (!deps.taxSnapshot && plan.steps.some((s) => TAX_SKILLS.has(s.skillId))) {
    deps.taxSnapshot = await taxRegimeProvider(companyId, deps);
  }

  const outcomes = await executePlan(plan, companyId, { deps });
  return buildAnswer(plan, outcomes);
}
