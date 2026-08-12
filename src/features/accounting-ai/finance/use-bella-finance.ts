/**
 * Bella Contadora — Finance: hook de leitura do painel.
 *
 * Nenhum estado novo: reutiliza `useAccountingAiSummary` (React Query) e
 * apenas memoiza o view model puro.
 */
import { useMemo } from "react";
import { useAccountingAiSummary } from "../hooks/use-accounting-ai";
import { buildBellaFinanceView } from "./selectors";
import type { BellaFinanceOptions, BellaFinanceView } from "./types";

export function useBellaFinance(
  companyId: string | undefined,
  options: BellaFinanceOptions = {},
): { view: BellaFinanceView; isLoading: boolean } {
  const { data, isLoading, error } = useAccountingAiSummary(companyId);
  if (error) {
    console.error("Bella Finance error fetching summary:", error);
  }
  const { alertLimit, recommendationLimit } = options;

  const view = useMemo(
    () => buildBellaFinanceView({ summary: data || null }, { alertLimit, recommendationLimit }),
    [data, alertLimit, recommendationLimit],
  );

  return { view, isLoading };
}
