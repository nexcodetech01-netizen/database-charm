/**
 * Bella Contadora — ExplanationSelectors (Sprint 7.3).
 *
 * Funções puras de leitura: transformam uma `Explanation` já construída
 * no formato obrigatório de resposta. Nenhum número é recalculado aqui.
 *
 *   Resumo → 3 principais causas → dados que comprovam → recomendação
 */
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

  const causes = explanation.causes
    .map((c, index) => `${index + 1}. ${c.detail}`)
    .join(" ");
  const evidence = explanation.evidence
    .map((e) => `${e.label}: ${e.value}`)
    .join(" · ");
  const biggest = explanation.biggestImpact
    ? ` Maior impacto: ${explanation.biggestImpact.label}.`
    : "";
  const recommendation = explanation.recommendation
    ? ` Recomendação: ${explanation.recommendation}`
    : "";

  return `${explanation.summary} Principais causas: ${causes}${biggest} Dados: ${evidence}.${recommendation}`.replace(
    /\s+/g,
    " ",
  );
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
  const items = ranking.map((c, index) => `${index + 1}. ${c.detail}`).join(" ");
  const top = ranking[0]!;
  return `Maiores impactos do período: ${items} Maior impacto: ${top.label} (${top.effect}).`;
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
  return lines.join(" ");
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
