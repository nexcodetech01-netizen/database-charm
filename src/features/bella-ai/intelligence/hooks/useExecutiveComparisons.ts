import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getExecutiveComparisons } from "../service.functions";
import type { ComparisonResult, PeriodKey } from "../types";

const STALE_MS = 5 * 60 * 1000;

export function useExecutiveComparisons(period: PeriodKey = "month") {
  const call = useServerFn(getExecutiveComparisons);
  return useQuery<ComparisonResult[]>({
    queryKey: ["bella", "executive", "comparisons", period],
    queryFn: () => call({ data: { period } }),
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });
}
