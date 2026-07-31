import { supabase } from "@/integrations/supabase/client";
import { financeService } from "./finance.service";
import type { FinanceOverview } from "../types";

/**
 * FinanceQueryService
 *
 * Camada de leitura consolidada para consumidores externos ao módulo
 * Financeiro (ex.: Bella IA). Reutiliza `financeService` — não duplica
 * consultas — e adiciona apenas os agregados que ainda não existiam:
 * contagem de vencidas e fluxo previsto para os próximos 30 dias.
 */

export interface FinanceSnapshot {
  overview: FinanceOverview;
  overdueCount: number;
  overdueAmount: number;
  forecast30d: {
    incoming: number;
    outgoing: number;
    net: number;
  };
  hasData: boolean;
}

export const financeQueryService = {
  async snapshot(companyId: string): Promise<FinanceSnapshot> {
    const overview = await financeService.overview(companyId);

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const in30 = new Date();
    in30.setDate(now.getDate() + 30);
    const in30Str = `${in30.getFullYear()}-${String(in30.getMonth() + 1).padStart(2, "0")}-${String(in30.getDate()).padStart(2, "0")}`;

    const { data, error } = await supabase
      .from("financial_transactions")
      .select("type,status,amount,due_date,transaction_date")
      .eq("company_id", companyId)
      .neq("status", "cancelled");
    if (error) throw error;

    const rows = data ?? [];

    // Vencido: due_date estritamente MENOR que hoje (data local).
    // Vencimento HOJE não é vencido.
    const isOverdue = (row: (typeof rows)[number]) => {
      if (row.status === "paid" || row.status === "cancelled") return false;
      const dueStr = (row.due_date ?? row.transaction_date)?.slice(0, 10);
      if (!dueStr) return false;
      return dueStr < todayStr;
    };

    const overdue = rows.filter(isOverdue);
    const overdueAmount = overdue.reduce((s, r) => s + Number(r.amount ?? 0), 0);

    const inNext30 = (row: (typeof rows)[number]) => {
      if (row.status === "paid") return false;
      const dueStr = (row.due_date ?? row.transaction_date)?.slice(0, 10);
      if (!dueStr) return false;
      return dueStr >= todayStr && dueStr <= in30Str;
    };

    const forecastRows = rows.filter(inNext30);
    const incoming = forecastRows
      .filter((r) => r.type === "income")
      .reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const outgoing = forecastRows
      .filter((r) => r.type === "expense")
      .reduce((s, r) => s + Number(r.amount ?? 0), 0);

    const hasData =
      rows.length > 0 ||
      overview.currentBalance !== 0 ||
      overview.receivable !== 0 ||
      overview.payable !== 0;

    return {
      overview,
      overdueCount: overdue.length,
      overdueAmount,
      forecast30d: { incoming, outgoing, net: incoming - outgoing },
      hasData,
    };
  },
};
