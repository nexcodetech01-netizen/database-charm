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
import { explanationProvider } from "../explanation/provider";
import { detectIntent } from "./intent-engine";
import { planIntent } from "./planner";
import { executePlan } from "./router";
import { buildAnswer } from "./response-builder";
import { buildTrace } from "./trace";
import { bellaTelemetry, now } from "../telemetry";
import type { ChatAnswer, ChatContextState } from "./types";

export * from "./types";
export * from "./intent-engine";
export * from "./planner";
export * from "./router";
export * from "./response-builder";
export * from "./trace";
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
  const startedAt = now();
  const cache = { hits: 0, misses: 0 };
  const match = detectIntent(question, { context: options.context ?? null });
  const plan = planIntent(match);
  if (plan.shape === "none") {
    bellaTelemetry.record({
      kind: "chat",
      label: "intent_desconhecida",
      durationMs: now() - startedAt,
    });
    return buildAnswer(plan, []);
  }

  const baseDeps = options.deps;
  let summary = baseDeps?.summary ?? null;
  if (summary) {
    cache.hits += 1;
    bellaTelemetry.record({ kind: "summary", label: "summary", durationMs: 0, cache: "hit" });
  } else {
    cache.misses += 1;
    summary = await bellaTelemetry.measure(
      { kind: "summary", label: "summary", cache: "miss", providers: 15 },
      () => buildAccountingSummary(companyId, baseDeps),
    );
  }
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
  if (plan.steps.some((s) => TAX_SKILLS.has(s.skillId))) {
    if (deps.taxSnapshot) {
      cache.hits += 1;
      bellaTelemetry.record({ kind: "tax", label: "tax_snapshot", durationMs: 0, cache: "hit" });
    } else {
      cache.misses += 1;
      deps.taxSnapshot = await bellaTelemetry.measure(
        { kind: "tax", label: "tax_snapshot", cache: "miss", providers: 1 },
        () => taxRegimeProvider(companyId, deps),
      );
    }
  }

  // Sprint 7.3 — o retrato de explicações também é lido UMA vez por
  // pergunta. Ele apenas compara números já apurados pelos motores.
  const EXPLAIN_SKILLS = new Set([
    "explicar_lucro",
    "explicar_caixa",
    "explicar_receita",
    "explicar_despesas",
    "explicar_impostos",
    "explicar_ticket",
    "explicar_estoque",
    "explicar_resultado",
    "explicar_indicadores",
  ]);
  if (plan.steps.some((s) => EXPLAIN_SKILLS.has(s.skillId))) {
    if (deps.explanation) {
      cache.hits += 1;
      bellaTelemetry.record({
        kind: "explanation",
        label: "explanation_snapshot",
        durationMs: 0,
        cache: "hit",
      });
    } else {
      if (!deps.taxSnapshot) {
        cache.misses += 1;
        deps.taxSnapshot = await bellaTelemetry.measure(
          { kind: "tax", label: "tax_snapshot", cache: "miss", providers: 1 },
          () => taxRegimeProvider(companyId, deps),
        );
      }
      cache.misses += 1;
      deps.explanation = await bellaTelemetry.measure(
        { kind: "explanation", label: "explanation_snapshot", cache: "miss", providers: 2 },
        () => explanationProvider(companyId, deps),
      );
    }
  }

  const outcomes = await executePlan(plan, companyId, { deps });
  const durationMs = now() - startedAt;
  const trace = buildTrace({
    plan,
    outcomes,
    intentConfidence: match.confidence,
    deps,
    durationMs,
    cache,
  });
  bellaTelemetry.record({
    kind: "chat",
    label: `intent_${plan.intent}`,
    durationMs,
    providers: trace.providers.length,
    cache: cache.hits > 0 && cache.misses === 0 ? "hit" : "miss",
    ok: !trace.lowConfidence,
  });
  return buildAnswer(plan, outcomes, { trace });
}
