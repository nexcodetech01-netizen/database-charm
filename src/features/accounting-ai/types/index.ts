/**
 * Bella Contadora — tipos únicos do módulo `accounting-ai`.
 *
 * Esta camada NÃO calcula nada: apenas descreve os contratos de leitura
 * consumidos pelos providers/dashboard. Todos os números vêm dos serviços
 * já existentes do ERP (Accounting, Finance, Sales, Inventory, Fiscal, Cash).
 */

/** Período fechado (datas ISO `YYYY-MM-DD`). */
export interface AccountingPeriod {
  start: string;
  end: string;
  label?: string;
}

/** Origem declarada de um dado — usada para auditoria e para a UI. */
export type AccountingDataSource =
  | "accounting"
  | "finance"
  | "sales"
  | "inventory"
  | "fiscal"
  | "cash"
  | "reports";

/**
 * Envelope padrão de todo provider somente-leitura.
 * `available: false` significa "serviço ainda não fornece este dado" ou
 * "não há dados no período" — nunca um valor inventado.
 */
export interface ProviderResult<T> {
  available: boolean;
  data: T | null;
  source: AccountingDataSource;
  generatedAt: string;
  note?: string;
}

export interface RevenueSnapshot {
  period: AccountingPeriod;
  grossRevenue: number;
  deductions: number;
  netRevenue: number;
}

export interface ProfitAnalysis {
  period: AccountingPeriod;
  grossProfit: number;
  operatingResult: number;
  netProfit: number;
  ebitda: number;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  ebitdaMargin: number;
}

export interface ExpenseSnapshot {
  period: AccountingPeriod;
  cogs: number;
  operatingExpenses: number;
  financialExpenses: number;
  otherExpenses: number;
  totalExpenses: number;
  cogsRatio: number;
  expenseRatio: number;
}

export interface CashSnapshot {
  currentBalance: number;
  receivable: number;
  receivableOverdue: number;
  payable: number;
  projected: number;
  openSessions: number;
}

export interface CashProjection {
  horizonDays: number;
  incoming: number;
  outgoing: number;
  net: number;
  projectedBalance: number;
  monthly: { label: string; netRevenue: number; netProfit: number }[];
}

export interface TaxSummary {
  competence: string;
  revenue: number;
  taxAmount: number;
  effectiveRate: number;
  status: string | null;
  dueDate: string | null;
}

export interface InventorySnapshot {
  productCount: number;
  totalItems: number;
  inventoryValue: number;
  belowMinCount: number;
  stagnantCount: number;
}

export interface TicketSnapshot {
  period: AccountingPeriod;
  averageTicket: number;
  salesCount: number;
  monthTotal: number;
}

export interface MarginSnapshot {
  period: AccountingPeriod;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  ebitdaMargin: number;
  breakEven: number;
}

export interface ProductRanking {
  bestSellers: { id: string; name: string; sku: string | null; quantity: number; revenue: number }[];
  stagnant: { id: string; name: string; sku: string | null; stock: number }[];
  lowStock: { id: string; name: string; sku: string | null; stock: number; min_stock: number }[];
}

export interface CustomerSnapshot {
  total: number;
  active: number;
  newInRange: number;
  recurring: number;
  topCustomers: { id: string; name: string; purchases: number; revenue: number }[];
}

/** Sugestão de pró-labore — derivada, nunca persistida nesta sprint. */
export interface PayrollSuggestion {
  period: AccountingPeriod;
  basis: number;
  suggestedAmount: number;
  suggestedRate: number;
  reserveAmount: number;
  reserveRate: number;
  distributableProfit: number;
  confident: boolean;
  rationale: string;
}

export type HealthLevel = "critical" | "attention" | "healthy" | "unknown";

export interface FinancialHealth {
  level: HealthLevel;
  score: number;
  liquidity: number | null;
  workingCapital: number;
  debtRatio: number;
  reasons: string[];
}

export interface BusinessHealth {
  level: HealthLevel;
  score: number;
  financial: FinancialHealth;
  highlights: string[];
  warnings: string[];
}

/** Resumo consolidado exibido pelo dashboard da Bella Contadora. */
export interface AccountingSummary {
  companyId: string;
  period: AccountingPeriod;
  generatedAt: string;
  revenue: ProviderResult<RevenueSnapshot>;
  profit: ProviderResult<ProfitAnalysis>;
  expenses: ProviderResult<ExpenseSnapshot>;
  cash: ProviderResult<CashSnapshot>;
  cashFlow: ProviderResult<CashProjection>;
  taxes: ProviderResult<TaxSummary>;
  inventory: ProviderResult<InventorySnapshot>;
  ticket: ProviderResult<TicketSnapshot>;
  margin: ProviderResult<MarginSnapshot>;
  products: ProviderResult<ProductRanking>;
  customers: ProviderResult<CustomerSnapshot>;
  payroll: ProviderResult<PayrollSuggestion>;
  health: ProviderResult<BusinessHealth>;
}
