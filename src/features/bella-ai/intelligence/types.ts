/**
 * Bella Executive Intelligence — tipos compartilhados.
 *
 * Todo o módulo é orientado por dados reais do ERP (leituras via RLS).
 * Não há IA nos cálculos — apenas regras determinísticas.
 */

export type PeriodKey = "today" | "week" | "month" | "year";

export type ComparisonKey =
  | "today_vs_yesterday"
  | "week_vs_previous"
  | "month_vs_previous"
  | "year_vs_previous";

export type Direction = "up" | "down" | "flat";

export interface PeriodWindow {
  key: PeriodKey;
  label: string;
  from: string; // ISO date (YYYY-MM-DD)
  to: string;   // ISO date exclusive
  prevFrom: string;
  prevTo: string;
}

export interface ExecutiveMetrics {
  revenue_today: number;
  revenue_week: number;
  revenue_month: number;
  profit_month: number;
  margin_month_pct: number;
  avg_ticket_month: number;
  orders_month: number;
  new_customers_month: number;
  recurring_customers_month: number;
  products_sold_month: number;
  critical_stock_count: number;
  overdue_bills_count: number;
  overdue_bills_amount: number;
  upcoming_bills_count: number;
  upcoming_bills_amount: number;
}

export interface ComparisonResult {
  key: ComparisonKey;
  label: string;
  current: number;
  previous: number;
  delta: number;
  pct: number;        // ex.: 18 = +18%
  direction: Direction;
}

export type InsightTone = "positive" | "negative" | "neutral" | "warning";

export interface ExecutiveInsight {
  id: string;
  tone: InsightTone;
  message: string;
  metric?: string;
  value?: number | string;
}

export type RecommendationPriority = "high" | "medium" | "low";

export interface ExecutiveRecommendation {
  id: string;
  priority: RecommendationPriority;
  title: string;
  reason: string;
  suggestedAction: string;
  targetRoute?: string;
}

export type AlertSeverity = "critical" | "warning" | "info";

export interface ExecutiveAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  targetRoute?: string;
}

export type ScoreBand = "excelente" | "bom" | "atencao" | "critico";

export interface ExecutiveScore {
  score: number;      // 0-100
  band: ScoreBand;
  breakdown: {
    sales: number;
    finance: number;
    stock: number;
    customers: number;
  };
}

export interface ExecutiveSummary {
  generated_at: string;
  period: PeriodKey;
  metrics: ExecutiveMetrics;
  comparisons: ComparisonResult[];
  insights: ExecutiveInsight[];
  recommendations: ExecutiveRecommendation[];
  alerts: ExecutiveAlert[];
  score: ExecutiveScore;
  cache: { hit: boolean; duration_ms: number };
}

/** Rows brutas usadas pelo Engine — nomes espelham as tabelas Supabase. */
export interface RawSaleRow {
  id: string;
  sale_date: string | null;
  created_at: string;
  grand_total: number | null;
  status: string | null;
  customer_id: string | null;
}

export interface RawSaleItemRow {
  sale_id: string;
  product_id: string | null;
  quantity: number | null;
  unit_price: number | null;
  unit_cost: number | null;
  total: number | null;
}

export interface RawProductRow {
  id: string;
  name: string;
  stock: number | null;
  min_stock: number | null;
  price: number | null;
  cost: number | null;
}

export interface RawFinancialRow {
  id: string;
  type: string | null;
  amount: number | null;
  due_date: string | null;
  paid_at: string | null;
  status: string | null;
}

export interface RawCustomerRow {
  id: string;
  created_at: string;
}
