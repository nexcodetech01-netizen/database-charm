import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OperationalDefaults {
  freight: number;
  packaging: number;
  insurance: number;
  other_costs: number;
}

export const EMPTY_OPERATIONAL_DEFAULTS: OperationalDefaults = {
  freight: 0,
  packaging: 0,
  insurance: 0,
  other_costs: 0,
};

export const operationalDefaultsKey = (companyId: string | null | undefined) =>
  ["settings", "operational-defaults", companyId ?? null] as const;

/**
 * Custos operacionais padrão da empresa (Frete, Embalagem, Seguro, Outros custos).
 * Usado para pré-preencher os campos ao cadastrar um novo produto.
 * Produtos já existentes NÃO são alterados quando estes valores mudam.
 */
export function useOperationalDefaults(companyId: string | null | undefined) {
  return useQuery({
    queryKey: operationalDefaultsKey(companyId),
    enabled: !!companyId,
    staleTime: 60_000,
    queryFn: async (): Promise<OperationalDefaults> => {
      const { data, error } = await supabase
        .from("companies")
        .select("default_freight, default_packaging, default_insurance, default_other_costs")
        .eq("id", companyId!)
        .maybeSingle();
      if (error) throw error;
      return {
        freight: Number(data?.default_freight ?? 0),
        packaging: Number(data?.default_packaging ?? 0),
        insurance: Number(data?.default_insurance ?? 0),
        other_costs: Number(data?.default_other_costs ?? 0),
      };
    },
  });
}
