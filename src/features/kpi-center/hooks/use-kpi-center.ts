import { useQuery } from "@tanstack/react-query";
import { kpiCenterService } from "../services/kpi-center.service";
import type { KpiCenterFilters, KpiCenterResult } from "../types";

export const KPI_CENTER_KEY = ["kpi-center"] as const;

export function useKpiCenter(filters: KpiCenterFilters) {
  return useQuery<KpiCenterResult>({
    queryKey: [
      ...KPI_CENTER_KEY,
      filters.companyId,
      filters.range.from,
      filters.range.to,
      filters.categoryId ?? null,
      filters.supplierId ?? null,
      filters.priority ?? null,
      filters.origin ?? null,
    ],
    enabled: Boolean(filters.companyId),
    queryFn: () => kpiCenterService.build(filters),
    staleTime: 60_000,
  });
}
