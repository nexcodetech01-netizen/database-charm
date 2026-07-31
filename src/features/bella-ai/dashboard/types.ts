/**
 * Bella Dashboard — Tipos
 *
 * Modelo derivado 100% da camada `BellaEventEngine` / `BellaEventRegistry`.
 * Nenhum acesso a Services, Providers, Skills ou banco.
 */

import type { BellaEvent, BellaEventModule, EventPriority } from "../events";

export type DashboardPeriod = "hoje" | "ontem";

export interface BellaPriorityItem {
  id: string;
  eventId: string;
  title: string;
  description: string;
  recommendation?: string;
  priority: EventPriority;
  module: BellaEventModule;
  /** Identificador declarativo — a navegação real fica para outra sprint. */
  actionId?: string;
  createdAt: Date;
}

export interface BellaSummaryGroup {
  module: BellaEventModule;
  label: string;
  total: number;
  critical: number;
  warning: number;
}

export interface BellaMetricsSnapshot {
  totalActive: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  byModule: Record<BellaEventModule, number>;
}

export interface BellaInsightItem {
  id: string;
  message: string;
  tone: "positive" | "neutral" | "negative";
}

export interface BellaDailyBrief {
  greeting: string;
  summaryLine: string;
  prioritiesLine: string;
  financeLine: string;
  commercialLine: string;
  closingLine: string;
}

export interface BellaDashboardSnapshot {
  generatedAt: Date;
  tenantId: string;
  greeting: string;
  brief: BellaDailyBrief;
  priorities: BellaPriorityItem[];
  metrics: BellaMetricsSnapshot;
  insights: BellaInsightItem[];
  summary: BellaSummaryGroup[];
  /** Snapshot bruto opcional — útil para debug e memoização. */
  sourceEvents: BellaEvent[];
}
