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
  prolaboreSafeProvider,
  restockSuggestionsProvider,
  revenueProvider,
  taxesProvider,
  ticketProvider,
  todayProvider,
  trendsProvider,
  type ProviderDeps,
} from "./index";

export async function buildAccountingSummary(
  companyId: string,
  deps?: ProviderDeps,
): Promise<AccountingSummary> {
  const period = deps?.period ?? currentPeriod();
  // Novo a cada resumo: evita consultas repetidas durante esta agregação sem
  // reaproveitar dados entre aberturas da Bella.
  const scoped: ProviderDeps = { ...deps, period, cache: new Map() };

  const [
    revenue,
    today,
    trends,
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
    prolaboreSafe,
    restockSuggestions,
  ] = await Promise.all([
    revenueProvider(companyId, scoped),
    todayProvider(companyId, scoped),
    trendsProvider(companyId, scoped),
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
    prolaboreSafeProvider(companyId, scoped),
    restockSuggestionsProvider(companyId, scoped),
  ]);

  return {
    companyId,
    period,
    generatedAt: new Date().toISOString(),
    revenue,
    today,
    trends,
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
    prolaboreSafe,
    restockSuggestions,
  };
}

