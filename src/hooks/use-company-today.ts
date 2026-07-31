import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Data operacional da empresa (fonte da verdade no servidor).
 * Usa a mesma referência temporal já adotada pelo Financeiro/Caixa:
 * a função SQL `public.company_today(_company_id)`, que resolve o "hoje"
 * no fuso horário da empresa — nunca em UTC.
 */
export function useCompanyToday(companyId: string | undefined) {
  const query = useQuery({
    queryKey: ["company-today", companyId],
    enabled: !!companyId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("company_today", {
        _company_id: companyId as string,
      });
      if (error) throw error;
      return String(data);
    },
  });

  return {
    companyToday: query.data ?? null,
    isLoading: query.isLoading,
  };
}
