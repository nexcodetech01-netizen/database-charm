import { useQuery } from "@tanstack/react-query";
import { alertsService } from "../services/alerts.service";
import { recommendationsService } from "../services/recommendations.service";
import { insightsService } from "../services/insights.service";
import { assistantService } from "../services/assistant.service";
import type { BellaDashboardMetrics } from "../types";

const KEY = ["bella-ai"] as const;

export function useBellaDashboard(companyId: string) {
  return useQuery<BellaDashboardMetrics>({
    queryKey: [...KEY, "dashboard", companyId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const [insights, activeAlerts, pending, recs] = await Promise.all([
        insightsService.totalAvailable(companyId),
        alertsService.countActive(companyId),
        recommendationsService.countPending(companyId),
        recommendationsService.list(companyId, "accepted"),
      ]);
      return {
        insightsAvailable: insights,
        activeAlerts,
        pendingRecommendations: pending,
        suggestedTasks: recs.length,
      };
    },
  });
}

export function useBellaAlerts(companyId: string) {
  return useQuery({
    queryKey: [...KEY, "alerts", companyId],
    enabled: Boolean(companyId),
    queryFn: () => alertsService.list(companyId),
  });
}

export function useBellaRecommendations(companyId: string) {
  return useQuery({
    queryKey: [...KEY, "recommendations", companyId],
    enabled: Boolean(companyId),
    queryFn: () => recommendationsService.list(companyId),
  });
}

export function useBellaInsights(companyId: string) {
  return useQuery({
    queryKey: [...KEY, "insights", companyId],
    enabled: Boolean(companyId),
    queryFn: () => insightsService.byCategory(companyId),
  });
}

export function useBellaConversations(companyId: string) {
  return useQuery({
    queryKey: [...KEY, "conversations", companyId],
    enabled: Boolean(companyId),
    queryFn: () => assistantService.listConversations(companyId),
  });
}
