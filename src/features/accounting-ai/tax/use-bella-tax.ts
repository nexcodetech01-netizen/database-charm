import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { taxRegimeProvider } from "./provider";
import { buildBellaTaxInsights } from "./insights";
import { buildBellaTaxNotifications } from "./notifications";
import { taxHeadline, taxMetrics } from "./selectors";
import { taxLinks } from "./links";
import type { BellaTaxSnapshot, BellaTaxView } from "./types";
import type { ProviderResult } from "../types";

/**
 * Leitura tributária da Bella. Somente consulta: providers → motor oficial.
 */
export interface UseBellaTaxOptions {
  /**
   * Retrato já lido pelo dashboard (BellaContext). Quando presente, o hook
   * não dispara consulta própria — evita o waterfall sem mudar a leitura.
   */
  preloaded?: ProviderResult<BellaTaxSnapshot> | null;
  loading?: boolean;
}

export function useBellaTax(
  companyId: string | undefined,
  options: UseBellaTaxOptions = {},
) {
  const query = useQuery({
    queryKey: ["bella-tax", companyId],
    enabled: Boolean(companyId) && options.preloaded === undefined,
    staleTime: 60_000,
    queryFn: () => taxRegimeProvider(companyId as string),
  });

  const view = useMemo<BellaTaxView>(() => {
    const result = options.preloaded !== undefined ? options.preloaded : query.data;
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
  }, [query.data, options.preloaded]);

  return {
    view,
    isLoading: options.preloaded !== undefined ? Boolean(options.loading) : query.isLoading,
    refetch: query.refetch,
  };
}
