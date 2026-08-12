import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { financeService } from "../services/finance.service";
import type {
  FinancialAccountInsert,
  FinancialAccountUpdate,
  FinancialCategoryInsert,
  FinancialCategoryUpdate,
  FinancialTransactionInsert,
  FinancialTransactionUpdate,
  TransactionListFilters,
  SettleTransactionInput,
  CompleteSettlementInput,
} from "../types";

export const financeKeys = {
  all: ["finance"] as const,
  accounts: (companyId: string) => ["finance", "accounts", companyId] as const,
  categories: (companyId: string) => ["finance", "categories", companyId] as const,
  transactions: (companyId: string, filters: TransactionListFilters) =>
    ["finance", "transactions", companyId, filters] as const,
  overview: (companyId: string) => ["finance", "overview", companyId] as const,
  incompleteSettlements: (companyId: string) =>
    ["finance", "incomplete-settlements", companyId] as const,
};

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: financeKeys.all });
}

// Accounts
export function useAccounts(companyId: string) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!companyId) return;

    // Nome do canal escopado por empresa, para não colidir quando o hook
    // é montado em mais de um lugar ao mesmo tempo (ex: Dashboard + Financeiro).
    const channelName = `finance_overview_sync-${companyId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'financial_accounts',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: financeKeys.accounts(companyId) });
          qc.invalidateQueries({ queryKey: financeKeys.overview(companyId) });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [companyId, qc]);

  return useQuery({
    queryKey: financeKeys.accounts(companyId),
    queryFn: async () => {
      try {
        return await financeService.listAccounts(companyId);
      } catch (error) {
        console.error("Error fetching accounts:", error);
        throw error;
      }
    },
    enabled: !!companyId,
  });
}
export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FinancialAccountInsert) => financeService.createAccount(input),
    onSuccess: () => invalidateAll(qc),
  });
}
export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: FinancialAccountUpdate }) =>
      financeService.updateAccount(id, input),
    onSuccess: () => invalidateAll(qc),
  });
}
export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeService.removeAccount(id),
    onSuccess: () => invalidateAll(qc),
  });
}

// Categories
export function useFinancialCategories(companyId: string) {
  return useQuery({
    queryKey: financeKeys.categories(companyId),
    queryFn: () => financeService.listCategories(companyId),
    enabled: !!companyId,
  });
}
export function useCreateFinancialCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FinancialCategoryInsert) => financeService.createCategory(input),
    onSuccess: () => invalidateAll(qc),
  });
}
export function useUpdateFinancialCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: FinancialCategoryUpdate }) =>
      financeService.updateCategory(id, input),
    onSuccess: () => invalidateAll(qc),
  });
}
export function useDeleteFinancialCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeService.removeCategory(id),
    onSuccess: () => invalidateAll(qc),
  });
}

// Transactions
export function useTransactions(companyId: string, filters: TransactionListFilters) {
  return useQuery({
    queryKey: financeKeys.transactions(companyId, filters),
    queryFn: () => financeService.listTransactions(companyId, filters),
    enabled: !!companyId,
  });
}
export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FinancialTransactionInsert) => financeService.createTransaction(input),
    onSuccess: () => invalidateAll(qc),
  });
}
/** Cria em aberto e liquida pelo motor único. Nunca insere `paid` direto. */
export function useCreateAndSettleTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      input,
      settle,
    }: {
      input: FinancialTransactionInsert;
      settle: SettleTransactionInput;
    }) => financeService.createAndSettleTransaction(input, settle),
    onSuccess: () => {
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: ["cash"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: FinancialTransactionUpdate }) =>
      financeService.updateTransaction(id, input),
    onSuccess: () => invalidateAll(qc),
  });
}
export function useSetTransactionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      financeService.setTransactionStatus(id, status),
    onSuccess: () => invalidateAll(qc),
  });
}
export function useReverseTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      financeService.reverseTransaction(id, notes),
    // Estorno afeta Financeiro, Caixa, Vendas e Dashboard.
    onSuccess: () => {
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: ["cash"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
    },
  });
}
export function useSettleTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SettleTransactionInput }) =>
      financeService.settleTransaction(id, input),
    // Baixa afeta Financeiro, Caixa, Vendas e Dashboard — atualiza tudo sem reload.
    onSuccess: () => {
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: ["cash"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useIncompleteSettlements(companyId: string) {
  return useQuery({
    queryKey: financeKeys.incompleteSettlements(companyId),
    queryFn: () => financeService.listIncompleteSettlements(companyId),
    enabled: !!companyId,
  });
}

export function useCompleteSettlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CompleteSettlementInput }) =>
      financeService.completeSettlement(id, input),
    onSuccess: () => {
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: ["cash"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financeService.removeTransaction(id),
    onSuccess: () => {
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: ["cash"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
    },
  });
}

// Overview
export function useFinanceOverview(companyId: string) {
  return useQuery({
    queryKey: financeKeys.overview(companyId),
    queryFn: async () => {
      try {
        return await financeService.overview(companyId);
      } catch (error) {
        console.error("Error fetching finance overview:", error);
        throw error;
      }
    },
    enabled: !!companyId,
  });
}
