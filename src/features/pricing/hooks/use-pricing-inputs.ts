/**
 * usePricingInputs — entradas oficiais do Motor Comercial V2 na borda (UI).
 * A UI nunca resolve margem, taxa ou imposto por conta própria.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EMPTY_FEE_TABLE } from "../official/fees";
import { EMPTY_COMPANY_COST_DEFAULTS } from "../lib/company-cost-defaults";
import { FALLBACK_MARGINS, fetchPricingInputs, type PricingInputs } from "../data/pricing-inputs";

export const EMPTY_PRICING_INPUTS: PricingInputs = {
  margins: FALLBACK_MARGINS,
  marginSource: "fallback",
  feeTable: EMPTY_FEE_TABLE,
  taxPct: 0,
  costDefaults: EMPTY_COMPANY_COST_DEFAULTS,
};

export function usePricingInputs(companyId: string | null | undefined, categoryId?: string | null) {
  const query = useQuery({
    queryKey: ["pricing", "inputs", companyId, categoryId ?? null],
    enabled: !!companyId,
    staleTime: 5 * 60_000,
    queryFn: () => fetchPricingInputs(supabase, companyId as string, categoryId ?? null),
  });

  return {
    inputs: query.data ?? EMPTY_PRICING_INPUTS,
    isLoading: query.isLoading,
    error: query.error,
  };
}
