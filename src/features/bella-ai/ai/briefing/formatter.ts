/**
 * Briefing Formatter — traduz `DailyBriefing.v1` em uma resposta
 * conversacional (`AIResponse.v1`) para exibição no chat.
 *
 * Zero cálculo novo — apenas transforma cards em texto.
 */
import {
  RESPONSE_VERSION,
  type AIResponse,
  type AISource,
} from "../contracts";
import type {
  BriefingCard,
  BriefingSection,
  DailyBriefing,
} from "./contracts";
import { BRIEFING_SOURCE_REGISTRY } from "./registry";

const SECTION_TITLES: Record<BriefingSection, string> = {
  overview: "Resumo",
  kpis: "KPIs do dia",
  alerts: "Alertas",
  priorities: "Prioridades",
  next_actions: "Próximas ações",
};

function renderCard(card: BriefingCard): string {
  const src = BRIEFING_SOURCE_REGISTRY[card.source].label;
  const conf = `confiança: ${card.confidence}`;
  const ts = card.timestamp;
  const meta = `_(fonte: ${src} • ${conf} • ${ts})_`;
  const detail = card.detail ? ` — ${card.detail}` : "";
  return `- **${card.title}**: ${card.value}${detail} ${meta}`;
}

export function formatDailyBriefing(briefing: DailyBriefing): AIResponse {
  const lines: string[] = [briefing.greeting, ""];

  const bySection = new Map<BriefingSection, BriefingCard[]>();
  for (const c of briefing.cards) {
    const arr = bySection.get(c.section) ?? [];
    arr.push(c);
    bySection.set(c.section, arr);
  }

  const order: BriefingSection[] = [
    "overview",
    "kpis",
    "alerts",
    "priorities",
    "next_actions",
  ];
  for (const section of order) {
    const arr = bySection.get(section);
    if (!arr || arr.length === 0) continue;
    lines.push(`### ${SECTION_TITLES[section]}`);
    for (const c of arr) lines.push(renderCard(c));
    lines.push("");
  }

  if (briefing.suggestedQuestions.length > 0) {
    lines.push("**Você pode perguntar:**");
    for (const q of briefing.suggestedQuestions) lines.push(`• ${q}`);
  }

  const sources: AISource[] = briefing.resolvedSources.map((id) => ({
    kind: "usecase" as const,
    useCase: BRIEFING_SOURCE_REGISTRY[id].useCase,
    toolCall: `briefing.source:${id}`,
    traceId: briefing.traceId,
  }));

  const confidence: AIResponse["confidence"] =
    briefing.resolvedSources.length === 0
      ? "low"
      : briefing.unavailableSources.length > 0
        ? "medium"
        : "high";

  return {
    version: RESPONSE_VERSION,
    summary: lines.join("\n").trim(),
    confidence,
    sources,
    actions: briefing.suggestedActions,
    warnings: briefing.unavailableSources.map((id) => ({
      code: "stale_data" as const,
      message: `${BRIEFING_SOURCE_REGISTRY[id].label}: dado indisponível.`,
      details: { source: id, useCase: BRIEFING_SOURCE_REGISTRY[id].useCase },
    })),
    suggestedQuestions: [...briefing.suggestedQuestions],
    traceId: briefing.traceId,
  };
}
