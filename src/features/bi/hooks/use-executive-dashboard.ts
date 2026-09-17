import { useQuery } from "@tanstack/react-query";
import { executiveDashboardService } from "../services/executive-dashboard.service";
import type { DateRange } from "@/features/reports/types";

export function useExecutiveDashboard(
  companyId: string,
  range: DateRange,
  operatorId?: string,
) {
  return useQuery({
    queryKey: ["bi", "executive-dashboard", companyId, range.from, range.to, operatorId],
    queryFn: () => executiveDashboardService.build(companyId, range, operatorId),
    enabled: Boolean(companyId),
    // Egress: sem polling. O painel recarrega ao trocar período ou via invalidação.
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  });
}
