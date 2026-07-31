/**
 * DailyBriefing.v1 — contrato canônico do Daily Briefing (AI-005).
 *
 * REGRAS (idênticas ao restante do módulo `ai/`):
 *   - NENHUM cálculo novo: cards derivam exclusivamente de DTOs
 *     retornados pela Application Layer.
 *   - NENHUMA persistência.
 *   - Se a fonte não estiver disponível, o card é emitido com
 *     `available=false` e `value="Dado indisponível."` — nunca estimar.
 */
import { z } from "zod";
import { aiSuggestedActionSchema, type AISuggestedAction } from "../contracts";

export const BRIEFING_VERSION = "DailyBriefing.v1" as const;

export const BRIEFING_SECTIONS = [
  "overview",
  "kpis",
  "alerts",
  "priorities",
  "next_actions",
] as const;
export type BriefingSection = (typeof BRIEFING_SECTIONS)[number];

/** Fontes possíveis. Fase 1 (v1): apenas `commercial` está disponível. */
export const BRIEFING_SOURCES = [
  "commercial",
  "financial",
  "inventory",
  "sales",
  "purchases",
] as const;
export type BriefingSourceId = (typeof BRIEFING_SOURCES)[number];

export const briefingConfidenceSchema = z.enum(["high", "medium", "low", "unavailable"]);
export type BriefingConfidence = z.infer<typeof briefingConfidenceSchema>;

export const briefingToneSchema = z.enum(["positive", "neutral", "warning", "critical"]);
export type BriefingTone = z.infer<typeof briefingToneSchema>;

export const briefingCardSchema = z.object({
  id: z.string().min(1),
  section: z.enum(BRIEFING_SECTIONS),
  title: z.string().min(1),
  value: z.string().min(1),
  detail: z.string().optional(),
  tone: briefingToneSchema,
  /** Fonte primária consultada para popular o card. */
  source: z.enum(BRIEFING_SOURCES),
  /** Use Case exato consumido (para auditoria). */
  useCase: z.string().min(1),
  confidence: briefingConfidenceSchema,
  /** Timestamp do dado (nowIso quando a fonte não expõe). */
  timestamp: z.string().min(1),
  available: z.boolean(),
});
export type BriefingCard = z.infer<typeof briefingCardSchema>;

export const dailyBriefingSchema = z.object({
  version: z.literal(BRIEFING_VERSION),
  traceId: z.string().min(1),
  occurredAt: z.string().min(1),
  companyId: z.string().min(1),
  greeting: z.string().min(1),
  cards: z.array(briefingCardSchema),
  suggestedQuestions: z.array(z.string().min(1)),
  suggestedActions: z.array(aiSuggestedActionSchema),
  /** Fontes que responderam com sucesso. */
  resolvedSources: z.array(z.enum(BRIEFING_SOURCES)),
  /** Fontes ainda não plugadas ou que falharam. */
  unavailableSources: z.array(z.enum(BRIEFING_SOURCES)),
  /** Duração total da construção (ms) — usado no AIInteractionEvent. */
  durationMs: z.number().nonnegative(),
});
export type DailyBriefing = z.infer<typeof dailyBriefingSchema>;

export interface BriefingClock {
  nowIso(): string;
  monotonicMs(): number;
}

export const systemBriefingClock: BriefingClock = {
  nowIso: () => new Date().toISOString(),
  monotonicMs: () =>
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now(),
};

export interface BriefingSourceDescriptor {
  readonly id: BriefingSourceId;
  readonly label: string;
  readonly useCase: string;
  /** Fase 1: apenas `commercial=true`. Demais permanecem `false` até
   *  os Use Cases correspondentes existirem na Application Layer. */
  readonly available: boolean;
}

export type { AISuggestedAction };
