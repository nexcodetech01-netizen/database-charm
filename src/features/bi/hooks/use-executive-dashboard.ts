import { useQuery } from "@tanstack/react-query";
import { executiveDashboardService } from "../services/executive-dashboard.service";
import type { DateRange } from "@/features/reports/types";

export function useExecutiveDashboard(companyId: string, range: DateRange) {
  return useQuery({
    queryKey: ["bi", "executive-dashboard", companyId, range.from, range.to],
    queryFn: () => executiveDashboardService.build(companyId, range),
    enabled: Boolean(companyId),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
