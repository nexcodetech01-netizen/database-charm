import { useQuery } from "@tanstack/react-query";
import {
  campaignAudienceService,
  type CampaignAudienceCriteria,
} from "../services/campaign-audience.service";

export const campaignAudienceKeys = {
  all: ["marketing", "audience"] as const,
  build: (companyId: string, criteria: CampaignAudienceCriteria) =>
    ["marketing", "audience", companyId, criteria] as const,
};

export function useCampaignAudience(
  companyId: string,
  criteria: CampaignAudienceCriteria,
  enabled = true,
) {
  return useQuery({
    queryKey: campaignAudienceKeys.build(companyId, criteria),
    queryFn: () => campaignAudienceService.build(companyId, criteria),
    enabled: enabled && !!companyId,
    staleTime: 30_000,
  });
}
