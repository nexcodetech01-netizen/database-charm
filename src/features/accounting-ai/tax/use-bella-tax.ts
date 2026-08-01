import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { taxRegimeProvider } from "./provider";
import { buildBellaTaxInsights } from "./insights";
import { buildBellaTaxNotifications } from "./notifications";
import { taxHeadline, taxMetrics } from "./selectors";
import { taxLinks } from "./links";
import type { BellaTaxView } from "./types";

/**
 * Leitura tributária da Bella. Somente consulta: providers → motor oficial.
 */
export function useBellaTax(companyId: string | undefined) {
  const query = useQuery({
    queryKey: ["bella-tax", companyId],
    enabled: Boolean(companyId),
    staleTime: 60_000,
    queryFn: () => taxRegimeProvider(companyId as string),
  });

  const view = useMemo<BellaTaxView>(() => {
    const result = query.data;
    const snapshot = result?.data ?? null;
    return {
      available: Boolean(result?.available && snapshot),
      note: result?.note,
      snapshot,
      headline: taxHeadline(snapshot),
      metrics: taxMetrics(snapshot),
      alerts: snapshot?.alerts ?? [],
      insights: buildBellaTaxInsights(snapshot),
      notifications: buildBellaTaxNotifications(snapshot),
      links: taxLinks(),
    };
  }, [query.data]);

  return { view, isLoading: query.isLoading, refetch: query.refetch };
}
