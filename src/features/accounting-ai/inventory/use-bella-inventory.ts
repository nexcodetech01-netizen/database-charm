/**
 * Bella Contadora — Estoque: hook de leitura do painel.
 *
 * Reutiliza integralmente hooks já existentes:
 *  - `useAccountingAiSummary` (Bella) → saúde, insights e notificações;
 *  - `useInventoryMetrics` e `useRecentMovements` (Estoque) → saldos,
 *    produtos críticos/parados, capital e movimentações.
 *
 * Nenhuma consulta nova ao banco e nenhuma regra de estoque.
 */
import { useMemo } from "react";
import { useInventoryMetrics, useRecentMovements } from "@/features/inventory";
import { useAccountingAiSummary } from "../hooks/use-accounting-ai";
import { buildBellaInventoryView } from "./selectors";
import type {
  BellaInventoryMetricsLike,
  BellaInventoryMovementLike,
  BellaInventoryOptions,
  BellaInventoryView,
} from "./types";

export function useBellaInventory(
  companyId: string | undefined,
  options: BellaInventoryOptions = {},
): { view: BellaInventoryView; isLoading: boolean } {
  const { data: summary, isLoading: summaryLoading } = useAccountingAiSummary(companyId);
  const metrics = useInventoryMetrics(companyId ?? "");
  const movements = useRecentMovements(companyId ?? "", 20);

  const { alertLimit, recommendationLimit, nearMinFactor } = options;

  const view = useMemo(
    () =>
      buildBellaInventoryView(
        {
          summary: summary ?? null,
          metrics: (metrics.data ?? null) as BellaInventoryMetricsLike | null,
          movements: (movements.data ?? null) as readonly BellaInventoryMovementLike[] | null,
        },
        { alertLimit, recommendationLimit, nearMinFactor },
      ),
    [summary, metrics.data, movements.data, alertLimit, recommendationLimit, nearMinFactor],
  );

  return {
    view,
    isLoading: summaryLoading || metrics.isLoading || movements.isLoading,
  };
}
