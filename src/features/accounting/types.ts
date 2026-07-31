/**
 * Motor Contábil — contratos de tipos.
 *
 * Todos os números vêm exclusivamente do banco (lançamentos em partidas
 * dobradas). Nenhum valor é mockado nesta camada.
 */

export type AccountingAccountType =
  | "ATIVO"
  | "PASSIVO"
  | "PATRIMONIO_LIQUIDO"
  | "RECEITA"
  | "DEDUCOES"
  | "CMV"
  | "DESPESA_OPERACIONAL"
  | "DESPESA_FINANCEIRA"
  | "OUTRAS_RECEITAS"
  | "OUTRAS_DESPESAS";

export type AccountingNature = "debit" | "credit";
export type AccountingSide = AccountingNature;

export interface AccountingAccount {
  id: string;
  companyId: string;
  code: string;
  name: string;
  type: AccountingAccountType;
  nature: AccountingNature;
  parentId: string | null;
  acceptsPosting: boolean;
  isDepreciation: boolean;
  active: boolean;
}

export interface AccountingAccountNode extends AccountingAccount {
  children: AccountingAccountNode[];
  level: number;
}

export interface AccountingEntryItemInput {
  code?: string;
  accountId?: string;
  side: AccountingSide;
  amount: number;
  memo?: string;
}

export interface AccountingBalanceLine {
  code: string;
  name: string;
  type: AccountingAccountType;
  amount: number;
}

export interface DreReport {
  period: { start: string; end: string };
  grossRevenue: number;
  deductions: number;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  operatingResult: number;
  financialExpenses: number;
  otherRevenues: number;
  otherExpenses: number;
  resultBeforeTaxes: number;
  netProfit: number;
  depreciation: number;
  ebitda: number;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  ebitdaMargin: number;
  lines: AccountingBalanceLine[];
}

export interface BalanceSheetReport {
  asOf: string;
  assets: number;
  liabilities: number;
  equity: number;
  equityCapital: number;
  periodResult: number;
  balanced: boolean;
  difference: number;
  lines: AccountingBalanceLine[];
}

export interface FinancialKpis {
  period: { start: string; end: string };
  currentLiquidity: number | null;
  workingCapital: number;
  debtRatio: number;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  ebitda: number;
  ebitdaMargin: number;
  roi: number;
  roe: number;
  averageTicket: number;
  salesCount: number;
  cogsRatio: number;
  expenseRatio: number;
  breakEven: number;
}
