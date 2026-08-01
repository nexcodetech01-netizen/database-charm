/**
 * Bella Contadora — Vendas: hook de leitura do painel.
 *
 * Reutiliza integralmente hooks já existentes:
 *  - `useAccountingAiSummary` (Bella) → saúde, insights, tendências, ranking;
 *  - `useSaleMetrics` (Vendas) → faturamento, ticket, contagens e status.
 *
 * Nenhuma consulta nova ao banco e nenhuma regra de venda.
 */
import { useMemo } from "react";
import { useSaleMetrics } from "@/features/sales";
import { useAccountingAiSummary } from "../hooks/use-accounting-ai";
import { buildBellaSalesView } from "./selectors";
import type { BellaSalesMetricsLike, BellaSalesOptions, BellaSalesView } from "./types";

export function useBellaSales(
  companyId: string | undefined,
  options: BellaSalesOptions = {},
): { view: BellaSalesView; isLoading: boolean } {
  const { data: summary, isLoading: summaryLoading } = useAccountingAiSummary(companyId);
  const metrics = useSaleMetrics(companyId ?? "");

  const { alertLimit, recommendationLimit, cancelRatioLimit } = options;

  const view = useMemo(
    () =>
      buildBellaSalesView(
        {
          summary: summary ?? null,
          metrics: (metrics.data ?? null) as BellaSalesMetricsLike | null,
        },
        { alertLimit, recommendationLimit, cancelRatioLimit },
      ),
    [summary, metrics.data, alertLimit, recommendationLimit, cancelRatioLimit],
  );

  return { view, isLoading: summaryLoading || metrics.isLoading };
}
