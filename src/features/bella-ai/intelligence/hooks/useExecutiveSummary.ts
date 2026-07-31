import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getExecutiveSummary } from "../service.functions";
import type { ExecutiveSummary, PeriodKey } from "../types";

const STALE_MS = 5 * 60 * 1000;

export function useExecutiveSummary(period: PeriodKey = "month") {
  const call = useServerFn(getExecutiveSummary);
  return useQuery<ExecutiveSummary>({
    queryKey: ["bella", "executive", "summary", period],
    queryFn: () => call({ data: { period } }),
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });
}
