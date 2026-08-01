/**
 * Bella Contadora — portas (contratos) de leitura.
 *
 * A Bella NUNCA acessa o Supabase nem recalcula regras: ela declara portas
 * e os adaptadores as ligam aos serviços já existentes do NexOS.
 */
import type {
  BalanceSheetReport,
  DreReport,
  FinancialKpis,
} from "@/features/accounting";
import type { FinanceSnapshot } from "@/features/finance";
import type { CustomersReport, ProductsReport } from "@/features/reports";
import type {
  CompanyTaxProfile,
  SimplesAnnex,
  SimplesComputation,
  TaxApportionment,
  TaxProjection,
} from "@/features/tax";
import type { AccountingPeriod } from "../types";

export interface AccountingPort {
  dre(companyId: string, period: AccountingPeriod): Promise<DreReport>;
  balanceSheet(companyId: string, asOf: string): Promise<BalanceSheetReport>;
  kpis(companyId: string, period: AccountingPeriod): Promise<FinancialKpis>;
  monthlyEvolution(
    companyId: string,
    months: number,
  ): Promise<{ label: string; dre: DreReport }[]>;
}

export interface FinancePort {
  snapshot(companyId: string): Promise<FinanceSnapshot>;
}

export interface SalesPort {
  metrics(
    companyId: string,
    period: AccountingPeriod,
  ): Promise<{
    monthTotal: number;
    monthCount: number;
    averageTicket: number;
    /** Total pago dentro do intervalo consultado (já apurado pelo serviço). */
    paidTotal: number;
    /** Vendas pagas de hoje (data operacional resolvida no servidor). */
    dayTotal: number;
    dayCount: number;
  }>;
  products(companyId: string, period: AccountingPeriod): Promise<ProductsReport>;
  customers(companyId: string, period: AccountingPeriod): Promise<CustomersReport>;
}

export interface InventoryPort {
  metrics(companyId: string): Promise<{
    productCount: number;
    totalItems: number;
    inventoryValue: number;
    belowMin: { id: string; name: string; sku: string | null; stock: number; min_stock: number }[];
    stagnant: { id: string; name: string; sku: string | null; stock: number }[];
  }>;
}

export interface FiscalPort {
  monthlyRevenue(companyId: string, competence: string): Promise<number>;
  apportionments(companyId: string, limit?: number): Promise<TaxApportionment[]>;
  /** Perfil tributário oficial (regime, anexo, dia de vencimento). */
  profile(companyId: string): Promise<CompanyTaxProfile | null>;
  /** Receita bruta acumulada 12 meses — RPC `company_rbt12`. */
  rbt12(companyId: string, competence: string): Promise<number>;
  /** Apuração já existente da competência (nunca gera nova). */
  apportionment(
    companyId: string,
    competence: string,
  ): Promise<TaxApportionment | null>;
  /** Motor oficial do Simples — RPC `simples_compute`. */
  simulateSimples(
    annex: SimplesAnnex,
    rbt12: number,
    revenue: number,
  ): Promise<SimplesComputation>;
  /** Projeções oficiais — RPC `project_tax_scenarios`. */
  projectScenarios(
    companyId: string,
    competence: string,
    growths?: number[],
  ): Promise<TaxProjection>;
}

export interface CashPort {
  listSessions(companyId: string, limit?: number): Promise<{ status: string }[]>;
}

/** Bundle único injetado nos providers (facilita testes com fakes). */
export interface AccountingAiServices {
  readonly accounting: AccountingPort;
  readonly finance: FinancePort;
  readonly sales: SalesPort;
  readonly inventory: InventoryPort;
  readonly fiscal: FiscalPort;
  readonly cash: CashPort;
}
