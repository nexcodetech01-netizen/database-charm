import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { financeService } from "./finance.service";
import type { FinanceOverview } from "../types";
import { isTerminalTransactionStatus } from "../lib/receivables";

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
  // CORRIGIDO (2026-09-16, auditoria de duplicação de lógica — achado
  // #5): este serviço é chamado tanto pela UI do navegador quanto pelas
  // skills financeiras da Bella (server function). Rodando no servidor
  // com o cliente padrão (sessão do navegador), o RLS devolvia tudo
  // vazio silenciosamente — a Bella respondia saldo/contas zeradas sem
  // erro nenhum. `client` opcional: chamadas existentes (sem passar
  // nada) continuam idênticas a antes; quem chama do servidor
  // (finance-skills.ts) passa explicitamente `supabaseAdmin`.
  async snapshot(companyId: string, client: SupabaseClient<Database> = supabase): Promise<FinanceSnapshot> {
    const overview = await financeService.overview(companyId, client);

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const in30 = new Date();
    in30.setDate(now.getDate() + 30);
    const in30Str = `${in30.getFullYear()}-${String(in30.getMonth() + 1).padStart(2, "0")}-${String(in30.getDate()).padStart(2, "0")}`;

    // CORRIGIDO (2026-09-16): só excluía 'cancelled' — um lançamento
    // 'refunded' (estornado) continuava entrando nas contas vencidas e
    // na previsão de 30 dias abaixo (o mesmo bug já corrigido em
    // receivables.ts/deriveRowStatus, que ficou faltando aqui). Como
    // este serviço é o que a Bella usa pra responder saldo/contas a
    // receber/pagar, o valor errado ia direto pra conversa com a
    // pessoa. Ver isTerminalTransactionStatus em lib/receivables.ts.
    const { data, error } = await client
      .from("financial_transactions")
      .select("type,status,amount,due_date,transaction_date")
      .eq("company_id", companyId)
      .not("status", "in", "(cancelled,refunded)");
    if (error) throw error;

    const rows = data ?? [];

    // Vencido: due_date estritamente MENOR que hoje (data local).
    // Vencimento HOJE não é vencido.
    const isOverdue = (row: (typeof rows)[number]) => {
      if (row.status === "paid" || isTerminalTransactionStatus(row.status)) return false;
      const dueStr = (row.due_date ?? row.transaction_date)?.slice(0, 10);
      if (!dueStr) return false;
      return dueStr < todayStr;
    };

    const overdue = rows.filter(isOverdue);
    const overdueAmount = overdue.reduce((s, r) => s + Number(r.amount ?? 0), 0);

    const inNext30 = (row: (typeof rows)[number]) => {
      if (row.status === "paid" || isTerminalTransactionStatus(row.status)) return false;
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
