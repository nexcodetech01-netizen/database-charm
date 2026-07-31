import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getExecutiveScore } from "../service.functions";
import type { ExecutiveScore, PeriodKey } from "../types";

const STALE_MS = 5 * 60 * 1000;

export function useExecutiveScore(period: PeriodKey = "month") {
  const call = useServerFn(getExecutiveScore);
  return useQuery<ExecutiveScore>({
    queryKey: ["bella", "executive", "score", period],
    queryFn: () => call({ data: { period } }),
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });
}
