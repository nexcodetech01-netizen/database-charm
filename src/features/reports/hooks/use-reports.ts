import { useQuery } from "@tanstack/react-query";
import { reportsService } from "../services/reports.service";
import { useDataScope } from "@/features/sales/lib/test-data-scope";
import type { DateRange } from "../types";

const key = (
  name: string,
  companyId: string,
  range: DateRange,
  scope: string = "production",
) => ["reports", name, companyId, range.from, range.to, scope] as const;

export function useExecutiveMetrics(companyId: string, range: DateRange) {
  const scope = useDataScope();
  return useQuery({
    queryKey: key("executive", companyId, range, scope),
    queryFn: () => reportsService.executive(companyId, range),
    enabled: !!companyId,
    staleTime: 60_000,
  });
}
export function useSalesReport(companyId: string, range: DateRange) {
  const scope = useDataScope();
  return useQuery({
    queryKey: key("sales", companyId, range, scope),
    queryFn: () => reportsService.sales(companyId, range),
    enabled: !!companyId,
    staleTime: 60_000,
  });
}
export function useFinanceReport(companyId: string, range: DateRange) {
  const scope = useDataScope();
  return useQuery({
    queryKey: key("finance", companyId, range, scope),
    queryFn: () => reportsService.finance(companyId, range),
    enabled: !!companyId,
    staleTime: 60_000,
  });
}
export function useInventoryReport(companyId: string, range: DateRange) {
  const scope = useDataScope();
  return useQuery({
    queryKey: key("inventory", companyId, range, scope),
    queryFn: () => reportsService.inventory(companyId, range),
    enabled: !!companyId,
    staleTime: 60_000,
  });
}
export function usePurchasesReport(companyId: string, range: DateRange) {
  const scope = useDataScope();
  return useQuery({
    queryKey: key("purchases", companyId, range, scope),
    queryFn: () => reportsService.purchases(companyId, range),
    enabled: !!companyId,
    staleTime: 60_000,
  });
}
export function useProductsReport(companyId: string, range: DateRange) {
  const scope = useDataScope();
  return useQuery({
    queryKey: key("products", companyId, range, scope),
    queryFn: () => reportsService.products(companyId, range),
    enabled: !!companyId,
    staleTime: 60_000,
  });
}
export function useCustomersReport(companyId: string, range: DateRange) {
  const scope = useDataScope();
  return useQuery({
    queryKey: key("customers", companyId, range, scope),
    queryFn: () => reportsService.customers(companyId, range),
    enabled: !!companyId,
    staleTime: 60_000,
  });
}
