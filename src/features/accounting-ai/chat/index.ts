/**
 * Bella Contadora — Chat (Sprint 5.4).
 *
 * Fluxo: pergunta → IntentEngine → Planner → Router (skills existentes)
 * → ResponseBuilder → resposta em linguagem natural.
 *
 * Nenhum cálculo financeiro novo. Nenhuma IA generativa. Somente leitura.
 */
import type { ProviderDeps } from "../providers";
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
  const deps: ProviderDeps = { ...baseDeps, summary, period: summary.period };

  const outcomes = await executePlan(plan, companyId, { deps });
  return buildAnswer(plan, outcomes);
}
