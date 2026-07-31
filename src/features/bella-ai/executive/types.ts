/**
 * Bella Executive Intelligence — contratos de tipos.
 *
 * Esta camada NÃO calcula regras financeiras, contábeis ou tributárias:
 * ela apenas consolida, interpreta e projeta números já produzidos pelos
 * motores existentes (contábil, financeiro, tributário e de estoque),
 * entregues pela RPC `generate_executive_summary`.
 */

export interface ExecutivePeriod {
  start: string;
  end: string;
}

export interface ExecutiveDre {
  grossRevenue: number;
  deductions: number;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  operatingResult: number;
  financialExpenses: number;
  netProfit: number;
  depreciation: number;
  ebitda: number;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  ebitdaMargin: number;
}

export interface ExecutiveBalance {
  assets: number;
  liabilities: number;
  equity: number;
}

export interface ExecutiveCash {
  available: number;
  receivable: number;
  overdueReceivable: number;
  payable: number;
  overduePayable: number;
}

export interface ExecutiveInventory {
  value: number;
  items: number;
  staleItems: number;
}

export interface ExecutiveTax {
  regime: string | null;
  annex: string | null;
  rbt12: number;
  monthRevenue: number;
  estimatedTax: number;
  effectiveRate: number;
  limitUsagePct: number;
  bracket: number | null;
}

export interface ExecutiveProductRow {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  quantitySold: number;
  revenue: number;
  profit: number;
  /** Margem sobre receita do período (0 quando não houve venda). */
  margin: number;
  /** Giro aproximado do período: quantidade vendida / estoque atual. */
  turnover: number;
}

export interface ExecutiveCustomerRow {
  id: string;
  name: string;
  salesCount: number;
  revenue: number;
  overdueAmount: number;
  lastSaleAt: string | null;
  averageTicket: number;
}

export interface ExecutiveSupplierRow {
  id: string;
  name: string;
  purchasesCount: number;
  totalAmount: number;
  averageAmount: number;
  deliveryDays: number;
}

export interface ExecutiveRankings {
  products: ExecutiveProductRow[];
  customers: ExecutiveCustomerRow[];
  suppliers: ExecutiveSupplierRow[];
}

export interface ExecutiveSnapshot {
  companyId: string;
  period: ExecutivePeriod & { today: string };
  previousPeriod: ExecutivePeriod;
  dre: ExecutiveDre;
  previousDre: ExecutiveDre;
  balance: ExecutiveBalance;
  cash: ExecutiveCash;
  inventory: ExecutiveInventory;
  tax: ExecutiveTax;
  salesCount: number;
  rankings: ExecutiveRankings;
  generatedAt: string;
}

export type ExecutiveKpiFormat = "currency" | "percent" | "number" | "days" | "ratio";

export interface ExecutiveKpi {
  key: string;
  label: string;
  value: number | null;
  format: ExecutiveKpiFormat;
  group: "resultado" | "margem" | "liquidez" | "caixa" | "estoque" | "clientes" | "tributos" | "eficiencia";
  hint?: string;
}

export type ExecutiveSeverity = "info" | "warning" | "critical";

export interface ExecutiveInsight {
  id: string;
  title: string;
  description: string;
  severity: ExecutiveSeverity;
  metric?: number;
}

export interface ExecutiveAlert extends ExecutiveInsight {
  category: "receita" | "margem" | "caixa" | "tributos" | "estoque" | "clientes" | "capital";
}

export type ExecutiveHorizon = 7 | 15 | 30 | 90;

export interface ExecutiveForecastPoint {
  horizonDays: ExecutiveHorizon;
  revenue: number;
  cash: number;
  profit: number;
  taxes: number;
  workingCapital: number;
}

export type ExecutiveRiskKey =
  | "financeiro"
  | "caixa"
  | "tributario"
  | "estoque"
  | "operacional";

export interface ExecutiveRisk {
  key: ExecutiveRiskKey;
  label: string;
  /** 0 (crítico) a 100 (saudável). */
  score: number;
  severity: ExecutiveSeverity;
  reasons: string[];
}

export interface ExecutiveRiskReport {
  risks: ExecutiveRisk[];
  overallScore: number;
  severity: ExecutiveSeverity;
}

export type ExecutiveRecommendationAction =
  | "comprar_estoque"
  | "nao_comprar"
  | "aumentar_preco"
  | "reduzir_preco"
  | "cobrar_clientes"
  | "reduzir_despesas"
  | "fazer_promocao"
  | "evitar_compras"
  | "reservar_caixa"
  | "reservar_impostos";

export interface ExecutiveRecommendation {
  id: string;
  action: ExecutiveRecommendationAction;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
}

export interface ExecutiveReport {
  snapshot: ExecutiveSnapshot;
  kpis: ExecutiveKpi[];
  insights: ExecutiveInsight[];
  alerts: ExecutiveAlert[];
  forecast: ExecutiveForecastPoint[];
  risk: ExecutiveRiskReport;
  recommendations: ExecutiveRecommendation[];
}
