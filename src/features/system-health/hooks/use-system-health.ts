import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { HealthIssue } from "../lib/health";

export function useSystemHealth(companyId: string | undefined) {
  return useQuery({
    queryKey: ["system-health", companyId],
    enabled: !!companyId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<HealthIssue[]> => {
      // RPC nova (ainda fora dos tipos gerados).
      const rpc = supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => PromiseLike<{ data: HealthIssue[] | null; error: { message: string } | null }>;
      const { data, error } = await rpc("system_health_checks", { _company_id: companyId });
      if (error) throw error;
      return data ?? [];
    },
  });
}
