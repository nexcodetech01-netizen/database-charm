/**
 * Bella Contadora — composição do resumo consolidado.
 * Agrega providers em paralelo; nenhum cálculo adicional.
 */
import type { AccountingSummary } from "../types";
import { currentPeriod } from "../lib/helpers";
import {
  cashFlowProvider,
  cashProvider,
  customersProvider,
  expensesProvider,
  healthProvider,
  inventoryProvider,
  marginProvider,
  payrollProvider,
  productsProvider,
  profitProvider,
  revenueProvider,
  taxesProvider,
  ticketProvider,
  type ProviderDeps,
} from "./index";

export async function buildAccountingSummary(
  companyId: string,
  deps?: ProviderDeps,
): Promise<AccountingSummary> {
  const period = deps?.period ?? currentPeriod();
  const scoped: ProviderDeps = { ...deps, period };

  const [
    revenue,
    profit,
    expenses,
    cash,
    cashFlow,
    taxes,
    inventory,
    ticket,
    margin,
    products,
    customers,
    payroll,
    health,
  ] = await Promise.all([
    revenueProvider(companyId, scoped),
    profitProvider(companyId, scoped),
    expensesProvider(companyId, scoped),
    cashProvider(companyId, scoped),
    cashFlowProvider(companyId, scoped),
    taxesProvider(companyId, scoped),
    inventoryProvider(companyId, scoped),
    ticketProvider(companyId, scoped),
    marginProvider(companyId, scoped),
    productsProvider(companyId, scoped),
    customersProvider(companyId, scoped),
    payrollProvider(companyId, scoped),
    healthProvider(companyId, scoped),
  ]);

  return {
    companyId,
    period,
    generatedAt: new Date().toISOString(),
    revenue,
    profit,
    expenses,
    cash,
    cashFlow,
    taxes,
    inventory,
    ticket,
    margin,
    products,
    customers,
    payroll,
    health,
  };
}
