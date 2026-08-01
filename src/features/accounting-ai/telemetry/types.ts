/**
 * Bella Contadora — Telemetria (Sprint 7.4).
 *
 * Contratos de observabilidade SOMENTE LEITURA. Nenhum evento carrega
 * valores de negócio: apenas o tipo do retrato, duração, origem de cache
 * e a quantidade de providers envolvidos.
 */

/** Retratos e operações observadas. */
export type BellaTelemetryKind =
  | "summary"
  | "tax"
  | "audit"
  | "explanation"
  | "dashboard"
  | "chat";

export type BellaCacheOutcome = "hit" | "miss" | "none";

export interface BellaTelemetryEvent {
  /** Sequencial dentro do buffer — útil para ordenar em debug. */
  seq: number;
  kind: BellaTelemetryKind;
  /** Rótulo curto e higienizado (sem números, valores ou identificadores). */
  label: string;
  /** Tempo de geração em milissegundos. */
  durationMs: number;
  cache: BellaCacheOutcome;
  /** Quantos providers/leituras participaram da operação. */
  providers: number;
  ok: boolean;
  at: number;
}

export interface BellaTelemetryKindMetrics {
  kind: BellaTelemetryKind;
  count: number;
  /** Tempo médio de geração (ms). */
  averageMs: number;
  /** Maior tempo observado (ms). */
  maxMs: number;
  cacheHits: number;
  cacheMisses: number;
  /** hits / (hits + misses) — 0 quando não houve cache observável. */
  cacheHitRate: number;
  failures: number;
  providers: number;
}

export interface BellaTelemetrySnapshot {
  events: BellaTelemetryEvent[];
  byKind: BellaTelemetryKindMetrics[];
  totalEvents: number;
  averageMs: number;
  cacheHitRate: number;
}

/** Metadados internos de rastreabilidade de UMA resposta da Bella. */
export interface BellaAnswerTrace {
  intent: string;
  /** Confiança final (intenção × evidência disponível). */
  confidence: number;
  lowConfidence: boolean;
  /** Retratos consumidos (summary, tax, audit, explanation). */
  snapshots: string[];
  /** Providers que participaram da resposta. */
  providers: string[];
  /** KPIs consultados (nomes dos indicadores, nunca valores). */
  kpis: string[];
  skills: string[];
  /** Skills que responderam com dados. */
  usedSkills: string[];
  durationMs: number;
  cache: { hits: number; misses: number };
}
