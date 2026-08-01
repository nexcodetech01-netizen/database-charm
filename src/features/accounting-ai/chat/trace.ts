/**
 * Bella Contadora — Rastreabilidade das respostas (Sprint 7.4).
 *
 * Metadados INTERNOS para debug. Nada aqui é exibido ao usuário e nenhum
 * valor de negócio é registrado: apenas nomes de retratos, providers,
 * KPIs e skills que participaram da resposta.
 */
import type { ProviderDeps } from "../providers";
import type { BellaAnswerTrace } from "../telemetry/types";
import type { ChatPlan, ChatSkillOutcome } from "./types";

/** Confiança mínima aceitável para a Bella afirmar algo. */
export const MIN_ANSWER_CONFIDENCE = 0.35;

const SNAPSHOT_KEYS = [
  ["summary", "AccountingSummary"],
  ["taxSnapshot", "TaxSnapshot"],
  ["auditSnapshot", "AuditSnapshot"],
  ["explanation", "ExplanationSnapshot"],
] as const;

/** Retratos efetivamente disponíveis na resposta. */
export function usedSnapshots(deps?: ProviderDeps | null): string[] {
  if (!deps) return [];
  return SNAPSHOT_KEYS.filter(([key]) => Boolean(deps[key])).map(([, label]) => label);
}

/** Providers que participaram — derivados das chaves do resumo consolidado. */
export function usedProviders(deps?: ProviderDeps | null): string[] {
  const summary = deps?.summary;
  if (!summary) return [];
  const ignored = new Set(["companyId", "period", "generatedAt"]);
  return Object.keys(summary)
    .filter((key) => !ignored.has(key))
    .sort();
}

/** KPIs consultados — nomes dos campos lidos, nunca os valores. */
export function usedKpis(outcomes: readonly ChatSkillOutcome[]): string[] {
  const kpis = new Set<string>();
  for (const outcome of outcomes) {
    const data = outcome.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) continue;
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
        kpis.add(key);
      }
    }
  }
  return [...kpis].sort();
}

/**
 * Confiança final: confiança da intenção ponderada pela fração de skills
 * que realmente trouxeram evidência.
 */
export function answerConfidence(
  intentConfidence: number,
  usable: number,
  total: number,
): number {
  if (total === 0 || usable === 0) return 0;
  const evidence = usable / total;
  return Math.round(intentConfidence * (0.5 + 0.5 * evidence) * 100) / 100;
}

export interface BuildTraceInput {
  plan: ChatPlan;
  outcomes: readonly ChatSkillOutcome[];
  intentConfidence: number;
  deps?: ProviderDeps | null;
  durationMs?: number;
  cache?: { hits: number; misses: number };
}

export function buildTrace(input: BuildTraceInput): BellaAnswerTrace {
  const usable = input.outcomes.filter((o) => o.ok && o.text.trim().length > 0);
  const confidence = answerConfidence(
    input.intentConfidence,
    usable.length,
    input.outcomes.length,
  );
  return {
    intent: input.plan.intent,
    confidence,
    lowConfidence: confidence < MIN_ANSWER_CONFIDENCE,
    snapshots: usedSnapshots(input.deps),
    providers: usedProviders(input.deps),
    kpis: usedKpis(input.outcomes),
    skills: input.outcomes.map((o) => o.skillId),
    usedSkills: usable.map((o) => o.skillId),
    durationMs: Math.max(0, Math.round((input.durationMs ?? 0) * 1000) / 1000),
    cache: input.cache ?? { hits: 0, misses: 0 },
  };
}
