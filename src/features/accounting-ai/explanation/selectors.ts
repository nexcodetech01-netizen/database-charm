/**
 * Bella Contadora — ExplanationSelectors (Sprint 7.3).
 *
 * Funções puras de leitura: transformam uma `Explanation` já construída
 * no formato obrigatório de resposta. Nenhum número é recalculado aqui.
 *
 *   Resumo → 3 principais causas → dados que comprovam → recomendação
 */
import {
  evidenceList,
  formatSections,
  numbered,
  polish,
} from "../lib/response-format";
import {
  EXPLANATION_TOPIC_LABELS,
  NO_EVIDENCE,
  type Explanation,
  type ExplanationCause,
  type ExplanationSnapshot,
  type ExplanationTopic,
} from "./types";

/** Texto completo de uma explicação (usado pelas skills do chat). */
export function describeExplanation(explanation: Explanation | null): string {
  if (!explanation || !explanation.available) return NO_EVIDENCE;

  const causes = numbered(explanation.causes.map((c) => c.detail));
  const biggest = explanation.biggestImpact
    ? ` Maior impacto: ${explanation.biggestImpact.label}.`
    : "";

  return formatSections({
    summary: explanation.summary,
    explanation: `${causes}${biggest}`,
    evidence: evidenceList(explanation.evidence),
    recommendation: explanation.recommendation ?? null,
  });
}

/** Explicação de um tema dentro do retrato. */
export function explanationFor(
  snapshot: ExplanationSnapshot | null,
  topic: ExplanationTopic,
): Explanation | null {
  return snapshot?.explanations[topic] ?? null;
}

/** Texto de um tema (atalho usado pelas skills). */
export function describeTopic(
  snapshot: ExplanationSnapshot | null,
  topic: ExplanationTopic,
): string {
  return describeExplanation(explanationFor(snapshot, topic));
}

/** Ranking "qual foi o maior impacto deste mês?". */
export function describeImpactRanking(
  snapshot: ExplanationSnapshot | null,
): string {
  const ranking = snapshot?.ranking ?? [];
  if (ranking.length === 0) return NO_EVIDENCE;
  const top = ranking[0]!;
  return formatSections({
    summary: `Maiores impactos do período — o de maior peso foi ${top.label} (${top.effect}).`,
    explanation: numbered(ranking.map((c) => c.detail)),
  });
}

/** Panorama dos temas explicáveis com evidência disponível. */
export function describeIndicators(
  snapshot: ExplanationSnapshot | null,
  topics: readonly ExplanationTopic[] = ["lucro", "receita", "despesas", "caixa", "impostos"],
): string {
  if (!snapshot) return NO_EVIDENCE;
  const lines = topics
    .map((topic) => snapshot.explanations[topic])
    .filter((e): e is Explanation => Boolean(e?.available))
    .map((e) => `${EXPLANATION_TOPIC_LABELS[e.topic]}: ${e.headline}`);
  if (lines.length === 0) return NO_EVIDENCE;
  return polish(lines.join(" "));
}

/** Maior causa negativa de um tema (usado pelo motor proativo). */
export function worstCause(
  snapshot: ExplanationSnapshot | null,
  topic: ExplanationTopic,
): ExplanationCause | null {
  const explanation = explanationFor(snapshot, topic);
  if (!explanation?.available) return null;
  return explanation.causes.find((c) => c.effect === "negativo") ?? null;
}

/** Maior causa positiva de um tema (usado pelo motor proativo). */
export function bestCause(
  snapshot: ExplanationSnapshot | null,
  topic: ExplanationTopic,
): ExplanationCause | null {
  const explanation = explanationFor(snapshot, topic);
  if (!explanation?.available) return null;
  return explanation.causes.find((c) => c.effect === "positivo") ?? null;
}
