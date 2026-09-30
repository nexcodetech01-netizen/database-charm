import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CategoryTotal } from "../lib/withdrawal-split";

export interface MonthlySummary {
  month: string;
    /** Tudo que foi vendido no mês (pago ou não). */
  revenue: number;
  /** Vendas pagas (total ou parcialmente). */
  received_revenue: number;
  /** Vendas pendentes (fiado, crediário, pagamento pendente). */
  pending_revenue: number;
  sales_count: number;
  refunds: number;
  cogs: number;
  expenses_total: number;
  expenses: CategoryTotal[];
  profit: number;
  merchandise_purchased: number;
  withdrawals_total: number;
  withdrawals: CategoryTotal[];
  pending: {
    uncategorized_expenses_count: number;
    uncategorized_expenses_total: number;
    items_without_cost: number;
  };
}

export interface WithdrawalCapacity {
  cash_balance: number;
  payables_30d: number;
  restock_cost_30d: number;
  safe_amount: number;
}

const toNumber = (value: unknown) => Number(value ?? 0) || 0;

/** Resultado do mês (vendas, custo, despesas, lucro, retiradas, pendências). */
export function useMonthlySummary(companyId: string | undefined, month: string) {
  return useQuery({
    queryKey: ["monthly-closing", "summary", companyId, month],
    enabled: !!companyId && /^\d{4}-\d{2}$/.test(month),
    staleTime: 60_000,
    queryFn: async (): Promise<MonthlySummary> => {
      const { data, error } = await supabase.rpc("monthly_closing_summary", {
        _company_id: companyId!,
        _month: `${month}-01`,
      });
      if (error) throw error;
      const raw = (data ?? {}) as Record<string, any>;
      const list = (value: unknown): CategoryTotal[] =>
        Array.isArray(value)
          ? value.map((row: any) => ({ category: String(row.category), total: toNumber(row.total) }))
          : [];
      return {
        month: String(raw.month ?? month),
                revenue: toNumber(raw.revenue),
        received_revenue: toNumber(raw.received_revenue),
        pending_revenue: toNumber(raw.pending_revenue),
        sales_count: toNumber(raw.sales_count),
        refunds: toNumber(raw.refunds),
        cogs: toNumber(raw.cogs),
        expenses_total: toNumber(raw.expenses_total),
        expenses: list(raw.expenses),
        profit: toNumber(raw.profit),
        merchandise_purchased: toNumber(raw.merchandise_purchased),
        withdrawals_total: toNumber(raw.withdrawals_total),
        withdrawals: list(raw.withdrawals),
        pending: {
          uncategorized_expenses_count: toNumber(raw.pending?.uncategorized_expenses_count),
          uncategorized_expenses_total: toNumber(raw.pending?.uncategorized_expenses_total),
          items_without_cost: toNumber(raw.pending?.items_without_cost),
        },
      };
    },
  });
}

/** Quanto é seguro retirar hoje (saldo − contas 30 dias − reposição). */
export function useWithdrawalCapacity(companyId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["monthly-closing", "withdrawal-capacity", companyId],
    enabled: !!companyId && enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<WithdrawalCapacity> => {
      const { data, error } = await supabase.rpc("compute_prolabore_safe_amount", {
        _company_id: companyId!,
      });
      if (error) throw error;
      const raw = (data ?? {}) as Record<string, unknown>;
      return {
        cash_balance: toNumber(raw.cash_balance),
        payables_30d: toNumber(raw.payables_30d),
        restock_cost_30d: toNumber(raw.restock_cost_30d),
        safe_amount: toNumber(raw.safe_amount),
      };
    },
  });
}
