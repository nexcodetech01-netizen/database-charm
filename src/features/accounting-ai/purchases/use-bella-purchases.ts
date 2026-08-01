/**
 * Bella Contadora — Compras: hook de leitura do painel.
 *
 * Reutiliza integralmente hooks já existentes:
 *  - `useAccountingAiSummary` (Bella) → saúde, insights e notificações;
 *  - `usePurchaseMetrics` / `usePurchasesList` / `useActiveSuppliersForPurchase`
 *    (Compras) → pedidos, totais, status e fornecedores;
 *  - `useInventoryMetrics` (Estoque) → produtos aguardando reposição.
 *
 * Nenhuma consulta nova ao banco e nenhuma regra de compra.
 */
import { useMemo } from "react";
import {
  useActiveSuppliersForPurchase,
  usePurchaseMetrics,
  usePurchasesList,
  type PurchaseListFilters,
} from "@/features/purchases";
import { useInventoryMetrics } from "@/features/inventory";
import { useAccountingAiSummary } from "../hooks/use-accounting-ai";
import { buildBellaPurchasesView } from "./selectors";
import type {
  BellaPurchaseOrderLike,
  BellaPurchaseSupplierLike,
  BellaPurchasesInventoryLike,
  BellaPurchasesMetricsLike,
  BellaPurchasesOptions,
  BellaPurchasesView,
} from "./types";

/** Leitura ampla e ordenada dos pedidos — mesma query já usada em /compras. */
const ORDERS_FILTERS: PurchaseListFilters = {
  search: "",
  status: "",
  supplierId: "",
  sortBy: "purchase_date",
  sortDir: "desc",
  page: 1,
  pageSize: 100,
};

export function useBellaPurchases(
  companyId: string | undefined,
  options: BellaPurchasesOptions = {},
): { view: BellaPurchasesView; isLoading: boolean } {
  const { data: summary, isLoading: summaryLoading } = useAccountingAiSummary(companyId);
  const metrics = usePurchaseMetrics(companyId ?? "");
  const orders = usePurchasesList(companyId ?? "", ORDERS_FILTERS);
  const suppliers = useActiveSuppliersForPurchase(companyId ?? "");
  const inventory = useInventoryMetrics(companyId ?? "");

  const { alertLimit, recommendationLimit, aboveAverageFactor, capitalRatioLimit } = options;

  const view = useMemo(
    () =>
      buildBellaPurchasesView(
        {
          summary: summary ?? null,
          metrics: (metrics.data ?? null) as BellaPurchasesMetricsLike | null,
          orders: (orders.data?.rows ?? null) as readonly BellaPurchaseOrderLike[] | null,
          suppliers: (suppliers.data ?? null) as readonly BellaPurchaseSupplierLike[] | null,
          inventory: (inventory.data ?? null) as BellaPurchasesInventoryLike | null,
        },
        { alertLimit, recommendationLimit, aboveAverageFactor, capitalRatioLimit },
      ),
    [
      summary,
      metrics.data,
      orders.data,
      suppliers.data,
      inventory.data,
      alertLimit,
      recommendationLimit,
      aboveAverageFactor,
      capitalRatioLimit,
    ],
  );

  return {
    view,
    isLoading:
      summaryLoading ||
      metrics.isLoading ||
      orders.isLoading ||
      suppliers.isLoading ||
      inventory.isLoading,
  };
}
