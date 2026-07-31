/**
 * Bella Priority Center
 *
 * Agregador puro: recebe eventos ativos e devolve os 4 mais importantes,
 * ordenados por prioridade → severidade → recência. Não conhece UI nem
 * navegação — a ação exposta é apenas um identificador declarativo.
 */

import {
  comparePriority,
  type BellaEvent,
  type BellaEventModule,
} from "../events";
import type { BellaPriorityItem } from "./types";

const SEVERITY_ORDER = { critical: 3, warning: 2, success: 1, info: 0 } as const;

/**
 * Mapa determinístico de "tipo de evento → ação sugerida".
 * A navegação real será conectada em outra sprint; aqui é só o rótulo.
 */
const ACTION_BY_MODULE: Record<BellaEventModule, string> = {
  finance: "open.finance",
  inventory: "open.inventory",
  customers: "open.customers",
  sales: "open.sales",
  fiscal: "open.fiscal",
};

export interface BuildPrioritiesOptions {
  limit?: number;
}

export function buildPriorities(
  events: BellaEvent[],
  options: BuildPrioritiesOptions = {},
): BellaPriorityItem[] {
  const limit = options.limit ?? 4;
  return events
    .slice()
    .sort((a, b) => {
      const byPriority = comparePriority(a.priority, b.priority);
      if (byPriority !== 0) return byPriority;
      const bySeverity = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
      if (bySeverity !== 0) return bySeverity;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .slice(0, limit)
    .map((event) => ({
      id: `priority-${event.id}`,
      eventId: event.id,
      title: event.title,
      description: event.description,
      recommendation: event.recommendation,
      priority: event.priority,
      module: event.module,
      actionId: ACTION_BY_MODULE[event.module],
      createdAt: event.createdAt,
    }));
}
