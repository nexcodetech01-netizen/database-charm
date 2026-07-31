import { useQuery } from "@tanstack/react-query";
import { executivePanelService } from "../services/executive-panel.service";
import type { BiFilters } from "../types";

export function useExecutivePanel(filters: BiFilters) {
  return useQuery({
    queryKey: [
      "bi",
      "executive-panel",
      filters.companyId,
      filters.range.from,
      filters.range.to,
      filters.categoryId ?? null,
      filters.supplierId ?? null,
    ],
    queryFn: () => executivePanelService.build(filters),
    enabled: Boolean(filters.companyId),
    staleTime: 60_000,
  });
}
