/**
 * useBellaDashboard (Sprint 7.2.1)
 *
 * Uma única query resolve summary + tributário + auditoria em paralelo
 * (`BellaContext.snapshots()`), eliminando os três waterfalls que existiam
 * quando cada bloco disparava sua própria leitura. Nenhum dado, cálculo ou
 * resposta muda: são exatamente os mesmos providers.
 */
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createBellaContext, type BellaSnapshots } from "../context/bella-context";
import { currentPeriod } from "../lib/helpers";
import type { AccountingPeriod } from "../types";

export function bellaDashboardQueryOptions(
  companyId: string | undefined,
  period?: AccountingPeriod,
) {
  const resolved = period ?? currentPeriod();
  return queryOptions<BellaSnapshots>({
    queryKey: ["accounting-ai", "dashboard", companyId, resolved.start, resolved.end],
    enabled: !!companyId,
    staleTime: 60_000,
    gcTime: 15 * 60_000,
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: false,
    queryFn: () =>
      createBellaContext({ companyId: companyId as string, period: resolved }).snapshots(),
  });
}

export function useBellaDashboard(
  companyId: string | undefined,
  period?: AccountingPeriod,
) {
  const query = useQuery(bellaDashboardQueryOptions(companyId, period));
  return {
    summary: query.data?.summary ?? null,
    tax: query.data?.tax ?? null,
    audit: query.data?.audit ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
