/**
 * Executive Engine — orquestra leitura → métricas → comparações →
 * insights → recomendações → score → alertas.
 *
 * Recebe um Supabase client já autenticado (RLS aplica automaticamente).
 * NÃO acessa services / providers / skills existentes.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

import type {
  ExecutiveSummary,
  PeriodKey,
  RawCustomerRow,
  RawFinancialRow,
  RawProductRow,
  RawSaleItemRow,
  RawSaleRow,
} from "./types";
import { buildExecutiveMetrics } from "./ExecutiveMetrics";
import { buildComparisons, type ComparisonWindows } from "./ExecutiveComparisons";
import { buildInsights } from "./ExecutiveInsights";
import { buildRecommendations } from "./ExecutiveRecommendations";
import { buildScore, type ScoreBaseline } from "./ExecutiveScore";
import { buildAlerts } from "./ExecutiveAlerts";
import { getCached, setCached } from "./ExecutiveCache";

type SB = SupabaseClient<Database>;

// ---- Janelas temporais -----------------------------------------------------

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeek(d: Date): Date {
  // Segunda como início da semana.
  const s = startOfDay(d);
  const day = s.getDay(); // 0 dom .. 6 sáb
  const diff = (day + 6) % 7;
  return addDays(s, -diff);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildWindows(now: Date): ComparisonWindows & {
  monthEnd: Date;
  prevYearStart: Date;
} {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);

  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);
  const prevWeekStart = addDays(weekStart, -7);

  const monthStart = startOfMonth(now);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  const prevMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);

  const yearStart = startOfYear(now);
  const nextYearStart = new Date(yearStart.getFullYear() + 1, 0, 1);
  const prevYearStart = new Date(yearStart.getFullYear() - 1, 0, 1);

  return {
    today: [today, tomorrow],
    yesterday: [yesterday, today],
    week: [weekStart, weekEnd],
    prevWeek: [prevWeekStart, weekStart],
    month: [monthStart, monthEnd],
    prevMonth: [prevMonthStart, monthStart],
    year: [yearStart, nextYearStart],
    prevYear: [prevYearStart, yearStart],
    monthEnd,
    prevYearStart,
  };
}

// ---- Fetchers (RLS aplica por company_id do usuário) -----------------------

async function fetchSales(supabase: SB, from: Date): Promise<RawSaleRow[]> {
  const { data, error } = await supabase
    .from("sales")
    .select("id, sale_date, created_at, grand_total, status, customer_id")
    .gte("created_at", from.toISOString())
    .limit(5000);
  if (error) throw error;
  return (data ?? []) as RawSaleRow[];
}

async function fetchSaleItems(
  supabase: SB,
  saleIds: readonly string[],
): Promise<RawSaleItemRow[]> {
  if (saleIds.length === 0) return [];
  // Paginar em blocos para evitar URL gigante.
  const CHUNK = 200;
  const out: RawSaleItemRow[] = [];
  for (let i = 0; i < saleIds.length; i += CHUNK) {
    const slice = saleIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("sale_items")
      .select("sale_id, product_id, quantity, unit_price, unit_cost, total")
      .in("sale_id", slice);
    if (error) throw error;
    out.push(...((data ?? []) as RawSaleItemRow[]));
  }
  return out;
}

async function fetchProducts(supabase: SB): Promise<RawProductRow[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, stock, min_stock, price, cost")
    .limit(5000);
  if (error) throw error;
  return (data ?? []) as RawProductRow[];
}

async function fetchOpenBills(supabase: SB): Promise<RawFinancialRow[]> {
  const { data, error } = await supabase
    .from("financial_transactions")
    .select("id, type, amount, due_date, paid_at, status")
    .eq("type", "expense")
    .is("paid_at", null)
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as RawFinancialRow[];
}

async function fetchCustomers(supabase: SB): Promise<RawCustomerRow[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("id, created_at")
    .limit(5000);
  if (error) throw error;
  return (data ?? []) as RawCustomerRow[];
}

// ---- Baseline --------------------------------------------------------------

function computeBaseline(
  sales: readonly RawSaleRow[],
  products: readonly RawProductRow[],
  customers: readonly RawCustomerRow[],
  now: Date,
): ScoreBaseline {
  // Faturamento médio dos últimos 90 dias projetado para mês (30d).
  const from = addDays(startOfDay(now), -90);
  let revenue90 = 0;
  for (const s of sales) {
    const status = (s.status ?? "").toLowerCase();
    if (status === "cancelled" || status === "canceled" || status === "returned") continue;
    const d = new Date(s.sale_date ?? s.created_at);
    if (d >= from && d < now) revenue90 += Number(s.grand_total) || 0;
  }
  const revenueGoalMonth = Math.round((revenue90 / 90) * 30);

  // Novos clientes/mês esperados: média dos últimos 90 dias.
  const custFrom = addDays(startOfDay(now), -90);
  let newIn90 = 0;
  for (const c of customers) {
    const d = new Date(c.created_at);
    if (d >= custFrom && d < now) newIn90++;
  }
  const newCustomersTarget = Math.max(1, Math.round((newIn90 / 90) * 30));

  return {
    revenueGoalMonth,
    totalExpectedBills: Math.max(revenueGoalMonth, 1),
    newCustomersTarget,
    activeProducts: products.length,
  };
}

// ---- Engine principal ------------------------------------------------------

export interface RunEngineOptions {
  companyId: string;
  period?: PeriodKey;
  force?: boolean;
}

export async function runExecutiveEngine(
  supabase: SB,
  opts: RunEngineOptions,
): Promise<ExecutiveSummary> {
  const started = Date.now();
  const period: PeriodKey = opts.period ?? "month";

  if (!opts.force) {
    const cached = getCached<ExecutiveSummary>(opts.companyId, period);
    if (cached) {
      console.info(
        `[ExecutiveEngine] cache_hit company=${opts.companyId} period=${period} duration_ms=${Date.now() - started}`,
      );
      return {
        ...cached,
        cache: { hit: true, duration_ms: Date.now() - started },
      };
    }
  }

  const now = new Date();
  const windows = buildWindows(now);

  // Buscamos vendas desde início do ano anterior para permitir ano-vs-ano.
  const [sales, products, bills, customers] = await Promise.all([
    fetchSales(supabase, windows.prevYearStart),
    fetchProducts(supabase),
    fetchOpenBills(supabase),
    fetchCustomers(supabase),
  ]);

  // sale_items apenas para vendas do mês atual (profit/margin/produtos vendidos).
  const monthSaleIds: string[] = [];
  for (const s of sales) {
    const status = (s.status ?? "").toLowerCase();
    if (status === "cancelled" || status === "canceled" || status === "returned") continue;
    const d = new Date(s.sale_date ?? s.created_at);
    if (d >= windows.month[0] && d < windows.month[1]) monthSaleIds.push(s.id);
  }
  const itemsMonth = await fetchSaleItems(supabase, monthSaleIds);

  const metrics = buildExecutiveMetrics({
    now,
    windows: {
      today: windows.today,
      week: windows.week,
      month: windows.month,
    },
    sales,
    itemsMonth,
    products,
    bills,
    customers,
  });

  const comparisons = buildComparisons(sales, windows);
  const insights = buildInsights(metrics, comparisons);
  const recommendations = buildRecommendations({
    now,
    metrics,
    products,
    sales,
    customers,
  });
  const alerts = buildAlerts(metrics, comparisons);
  const score = buildScore(metrics, computeBaseline(sales, products, customers, now));

  const summary: ExecutiveSummary = {
    generated_at: now.toISOString(),
    period,
    metrics,
    comparisons,
    insights,
    recommendations,
    alerts,
    score,
    cache: { hit: false, duration_ms: Date.now() - started },
  };

  setCached(opts.companyId, period, summary);
  console.info(
    `[ExecutiveEngine] cache_miss company=${opts.companyId} period=${period} duration_ms=${summary.cache.duration_ms} sales=${sales.length} items=${itemsMonth.length}`,
  );

  return summary;
}

/** Utilitário exposto para testes/inspeção. */
export const __internal__ = { buildWindows, iso };
