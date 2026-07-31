/**
 * Bella Metrics
 *
 * KPIs derivados dos eventos ativos. NÃO recalcula regras de negócio:
 * apenas conta e classifica o que o `BellaEventEngine` já emitiu.
 *
 * A ideia é oferecer "faturamento hoje / vendas hoje / novos clientes"
 * apenas quando o evento correspondente carrega o número em `payload`
 * (por convenção, os detectores enviam `payload.total`, `payload.count`
 * ou `payload.amount`). Quando ausente, o KPI simplesmente fica em 0 —
 * nenhuma consulta extra é feita.
 */

import type { BellaEvent, BellaEventModule } from "../events";
import type { BellaMetricsSnapshot } from "./types";

const MODULES: BellaEventModule[] = ["finance", "sales", "customers", "inventory"];

export function buildMetrics(events: BellaEvent[]): BellaMetricsSnapshot {
  const snapshot: BellaMetricsSnapshot = {
    totalActive: events.length,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    byModule: MODULES.reduce(
      (acc, m) => ((acc[m] = 0), acc),
      {} as Record<BellaEventModule, number>,
    ),
  };

  for (const event of events) {
    switch (event.priority) {
      case "CRITICAL":
        snapshot.critical += 1;
        break;
      case "HIGH":
        snapshot.high += 1;
        break;
      case "MEDIUM":
        snapshot.medium += 1;
        break;
      case "LOW":
        snapshot.low += 1;
        break;
    }
    if (snapshot.byModule[event.module] !== undefined) {
      snapshot.byModule[event.module] += 1;
    }
  }

  return snapshot;
}
