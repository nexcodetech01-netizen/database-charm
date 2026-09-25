import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CardPriceConfig } from "@/lib/pricing/card-price";
import { cardPriceConfigService } from "../services/card-price-config.service";

export const cardPriceConfigKeys = {
  byCompany: (companyId: string | null | undefined) =>
    ["card-price-config", companyId ?? "__none__"] as const,
};

export function useCardPriceConfig(companyId: string | null | undefined) {
  return useQuery({
    queryKey: cardPriceConfigKeys.byCompany(companyId),
    enabled: !!companyId,
    queryFn: () => cardPriceConfigService.get(companyId ?? ""),
    staleTime: 5 * 60_000,
  });
}

export function useSaveCardPriceConfig(companyId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: CardPriceConfig) =>
      cardPriceConfigService.save(companyId ?? "", config),
    onSuccess: (config) =>
      queryClient.setQueryData(cardPriceConfigKeys.byCompany(companyId), config),
  });
}