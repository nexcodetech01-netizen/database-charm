import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const cashGuardQueryKey = (saleId: string) =>
  ["checkout", "cash-open", saleId] as const;

/**
 * Revalida se o caixa vinculado à venda continua aberto enquanto o operador
 * está no checkout. O guard do banco (trg_enforce_sale_open_cash_upd) também
 * recusaria, mas aqui o feedback é imediato e evitamos chamar o Asaas.
 *
 * Retorna `true` somente quando a consulta confirmou que o caixa foi fechado.
 */
export function useCashSessionGuard(saleId: string, enabled: boolean): boolean {
  const { data: cashOpen } = useQuery({
    queryKey: cashGuardQueryKey(saleId),
    enabled,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      // Uma ida ao banco só: a sessão vem embutida pela FK.
      const { data, error } = await supabase
        .from("sales")
        .select("cash_session_id, cash_session:cash_sessions!sales_cash_session_id_fkey(status)")
        .eq("id", saleId)
        .maybeSingle();
      if (error) throw error;
      if (!data?.cash_session_id) return false;
      return data.cash_session?.status === "open";
    },
  });
  return cashOpen === false;
}
