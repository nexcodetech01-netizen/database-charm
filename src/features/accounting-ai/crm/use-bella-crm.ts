/**
 * Bella Contadora — CRM: hook de leitura do painel.
 *
 * Reutiliza integralmente hooks já existentes:
 *  - `useAccountingAiSummary` (Bella) → saúde, ticket, ranking, tendências;
 *  - `useCustomerMetrics` (Clientes) → base, ativos, novos e inativos;
 *  - `useCustomersReport` (Relatórios) → recorrência, inativos e ranking;
 *  - `useCustomersList` / `useSalesList` → último cadastro e última venda.
 *
 * Nenhuma consulta nova ao banco e nenhuma regra de cliente.
 */
import { useMemo } from "react";
import {
  useCustomerMetrics,
  useCustomersList,
  type CustomerListFilters,
} from "@/features/customers";
import { useCustomersReport } from "@/features/reports";
import { useSalesList } from "@/features/sales";
import type { SaleListFilters } from "@/features/sales";
import { useAccountingAiSummary } from "../hooks/use-accounting-ai";
import { buildBellaCrmView } from "./selectors";
import type {
  BellaCrmCustomerLike,
  BellaCrmMetricsLike,
  BellaCrmOptions,
  BellaCrmReportLike,
  BellaCrmSaleLike,
  BellaCrmView,
} from "./types";

/** Mesma leitura já usada em /clientes — apenas ordenada pelo cadastro. */
const CUSTOMERS_FILTERS: CustomerListFilters = {
  search: "",
  status: "",
  segment: "",
  state: "",
  sortBy: "created_at",
  sortDir: "desc",
  page: 1,
  pageSize: 100,
};

/** Mesma leitura já usada em /vendas — apenas ordenada pela data da venda. */
const SALES_FILTERS: SaleListFilters = {
  search: "",
  status: "",
  customerId: "",
  paymentMethod: "",
  paymentStatus: "",
  sortBy: "sale_date",
  sortDir: "desc",
  page: 1,
  pageSize: 50,
};

/** Mês corrente — mesmo preset já usado pelos relatórios do NexOS. */
function currentMonthRange(now: string): { from: string; to: string; preset: "this_month" } {
  const day = now.slice(0, 10);
  return { from: `${day.slice(0, 7)}-01`, to: day, preset: "this_month" };
}

export function useBellaCrm(
  companyId: string | undefined,
  options: BellaCrmOptions = {},
): { view: BellaCrmView; isLoading: boolean } {
  const { data: summary, isLoading: summaryLoading } = useAccountingAiSummary(companyId);
  const metrics = useCustomerMetrics(companyId ?? "");
  const range = useMemo(
    () => currentMonthRange(options.now ?? new Date().toISOString()),
    [options.now],
  );
  const report = useCustomersReport(companyId ?? "", range);
  const customers = useCustomersList(companyId ?? "", CUSTOMERS_FILTERS);
  const sales = useSalesList(companyId ?? "", SALES_FILTERS);

  const {
    alertLimit,
    recommendationLimit,
    now,
    vipRevenueShare,
    recurringRatioLimit,
    noContactDays,
  } = options;

  const view = useMemo(
    () =>
      buildBellaCrmView(
        {
          summary: summary ?? null,
          metrics: (metrics.data ?? null) as BellaCrmMetricsLike | null,
          report: (report.data ?? null) as BellaCrmReportLike | null,
          customers: (customers.data?.rows ?? null) as readonly BellaCrmCustomerLike[] | null,
          sales: (sales.data?.rows ?? null) as readonly BellaCrmSaleLike[] | null,
        },
        {
          alertLimit,
          recommendationLimit,
          now,
          vipRevenueShare,
          recurringRatioLimit,
          noContactDays,
        },
      ),
    [
      summary,
      metrics.data,
      report.data,
      customers.data,
      sales.data,
      alertLimit,
      recommendationLimit,
      now,
      vipRevenueShare,
      recurringRatioLimit,
      noContactDays,
    ],
  );

  return {
    view,
    isLoading:
      summaryLoading ||
      metrics.isLoading ||
      report.isLoading ||
      customers.isLoading ||
      sales.isLoading,
  };
}
