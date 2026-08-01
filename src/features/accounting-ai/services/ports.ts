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

/* ───────────── Sprint 7.2 — Auditoria (somente leitura) ───────────── */

export interface AuditTransactionRow {
  id: string;
  type: string;
  status: string;
  amount: number;
  description: string;
  dueDate: string | null;
  transactionDate: string | null;
  paidAt: string | null;
  referenceId: string | null;
  referenceNumber: string | null;
  source: string | null;
}

export interface AuditSaleRow {
  id: string;
  number: string | null;
  status: string;
  total: number;
  saleDate: string | null;
  customerId: string | null;
  /** Baixa registrada na própria venda. */
  paidAt: string | null;
  /** Liquidação financeira oficial (financial_transactions.paid_at). */
  settledAt: string | null;
}

export interface AuditCashSessionRow {
  id: string;
  status: string;
  openedAt: string | null;
  closedAt: string | null;
  expectedCash: number | null;
  countedCash: number | null;
  difference: number | null;
}

export interface AuditProductRow {
  id: string;
  name: string;
  sku: string | null;
  status: string | null;
  stock: number;
  minStock: number;
  cost: number | null;
  price: number | null;
  unit: string | null;
  ncm: string | null;
  categoryId: string | null;
  /** Anúncio ativo em marketplace (Mercado Livre). */
  marketplaceId: string | null;
}

export interface AuditCustomerRow {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  whatsapp: string | null;
  status: string | null;
}

export interface AuditFiscalDocumentRow {
  id: string;
  number: number | null;
  status: string;
  saleId: string | null;
  xmlAuthorizedPath: string | null;
  danfePath: string | null;
  rejectionReason: string | null;
}

export interface AuditFiscalDefaults {
  /** CST/CSOSN padrão configurado em `fiscal_settings`. */
  defaultCst: string | null;
}

export interface AuditStagnantProductRow {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
}

/**
 * Porta de auditoria — LEITURA pura sobre serviços já existentes.
 * Nenhum método pode gravar, corrigir ou recalcular qualquer dado.
 */
export interface AuditPort {
  transactions(companyId: string, limit?: number): Promise<AuditTransactionRow[]>;
  sales(companyId: string, limit?: number): Promise<AuditSaleRow[]>;
  cashSessions(companyId: string, limit?: number): Promise<AuditCashSessionRow[]>;
  products(companyId: string, limit?: number): Promise<AuditProductRow[]>;
  customers(companyId: string, limit?: number): Promise<AuditCustomerRow[]>;
  fiscalDocuments(
    companyId: string,
    limit?: number,
  ): Promise<AuditFiscalDocumentRow[]>;
  fiscalDefaults(companyId: string): Promise<AuditFiscalDefaults | null>;
  stagnantProducts(companyId: string): Promise<AuditStagnantProductRow[]>;
}

/** Bundle único injetado nos providers (facilita testes com fakes). */
export interface AccountingAiServices {
  readonly accounting: AccountingPort;
  readonly finance: FinancePort;
  readonly sales: SalesPort;
  readonly inventory: InventoryPort;
  readonly fiscal: FiscalPort;
  readonly cash: CashPort;
  readonly audit: AuditPort;
}

