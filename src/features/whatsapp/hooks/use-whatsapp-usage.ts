import { useQuery } from "@tanstack/react-query";
import { getWhatsAppMonthlyUsage } from "@/lib/whatsapp-usage.functions";

export const WHATSAPP_MONITORING_THRESHOLD = 500;

export function useWhatsAppMonthlyUsage(companyId: string) {
  return useQuery({
    queryKey: ["whatsapp", "monthly-usage", companyId],
    queryFn: () => getWhatsAppMonthlyUsage({ data: { companyId } }),
    enabled: Boolean(companyId),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}
