/**
 * Bella Dashboard
 *
 * Facade que compõe o snapshot completo da Home. Toda a informação é
 * derivada da camada `BellaEventEngine` / `BellaEventRegistry` — nenhum
 * Service, Provider ou Skill é chamado aqui.
 */

import {
  bellaEventRegistry,
  type BellaEvent,
  type BellaEventRegistry,
} from "../events";
import { buildPriorities } from "./BellaPriorityCenter";
import { buildMetrics } from "./BellaMetrics";
import { buildSummary } from "./BellaSummary";
import { buildInsights } from "./BellaInsightBuilder";
import { buildDailyBrief } from "./BellaDailyBrief";
import { resolveGreeting } from "./BellaGreeting";
import type { BellaDashboardSnapshot } from "./types";

export interface BuildDashboardOptions {
  tenantId: string;
  registry?: BellaEventRegistry;
  now?: Date;
  /** Permite injetar eventos (útil para testes ou dry-runs). */
  events?: BellaEvent[];
  /** Quantidade máxima de prioridades exibidas na Home. */
  priorityLimit?: number;
}

/**
 * Gera um snapshot completo do dashboard da Bella.
 * Log interno silencioso — nunca exposto ao usuário.
 */
export function buildDashboardSnapshot(
  options: BuildDashboardOptions,
): BellaDashboardSnapshot {
  const { tenantId } = options;
  const now = options.now ?? new Date();
  const registry = options.registry ?? bellaEventRegistry;
  const events = options.events ?? registry.listActive({ tenantId });

  const priorities = buildPriorities(events, { limit: options.priorityLimit ?? 4 });
  const metrics = buildMetrics(events);
  const summary = buildSummary(events);
  const insights = buildInsights(events);
  const brief = buildDailyBrief({ events, priorities, metrics, now });

  if (typeof console !== "undefined" && typeof console.debug === "function") {
    console.debug("[bella-dashboard] snapshot gerado", {
      tenantId,
      totalEvents: events.length,
      priorities: priorities.length,
      critical: metrics.critical,
    });
  }

  return {
    generatedAt: now,
    tenantId,
    greeting: resolveGreeting(now),
    brief,
    priorities,
    metrics,
    insights,
    summary,
    sourceEvents: events,
  };
}
