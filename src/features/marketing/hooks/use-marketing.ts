import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { marketingService } from "../services/marketing.service";
import type {
  MarketingCampaignInsert,
  MarketingCampaignUpdate,
  SegmentFilters,
} from "../types";

export const marketingKeys = {
  all: ["marketing"] as const,
  list: (companyId: string, filters?: unknown) =>
    ["marketing", "list", companyId, filters] as const,
  detail: (id: string) => ["marketing", "detail", id] as const,
  metrics: (companyId: string) => ["marketing", "metrics", companyId] as const,
  segment: (companyId: string, filters: SegmentFilters) =>
    ["marketing", "segment", companyId, filters] as const,
};

export function useCampaigns(
  companyId: string,
  filters?: { status?: string; channel?: string; search?: string },
) {
  return useQuery({
    queryKey: marketingKeys.list(companyId, filters),
    queryFn: () => marketingService.list(companyId, filters),
    enabled: !!companyId,
  });
}

export function useMarketingMetrics(companyId: string) {
  return useQuery({
    queryKey: marketingKeys.metrics(companyId),
    queryFn: () => marketingService.metrics(companyId),
    enabled: !!companyId,
  });
}

export function useSegmentCustomers(companyId: string, filters: SegmentFilters, enabled: boolean) {
  return useQuery({
    queryKey: marketingKeys.segment(companyId, filters),
    queryFn: () => marketingService.segmentCustomers(companyId, filters),
    enabled: enabled && !!companyId,
  });
}

export function useCreateCampaign(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MarketingCampaignInsert) => marketingService.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing", "list", companyId] });
      qc.invalidateQueries({ queryKey: marketingKeys.metrics(companyId) });
    },
  });
}

export function useUpdateCampaign(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: MarketingCampaignUpdate }) =>
      marketingService.update(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing", "list", companyId] });
      qc.invalidateQueries({ queryKey: marketingKeys.metrics(companyId) });
    },
  });
}

export function useDeleteCampaign(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => marketingService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing", "list", companyId] });
      qc.invalidateQueries({ queryKey: marketingKeys.metrics(companyId) });
    },
  });
}
