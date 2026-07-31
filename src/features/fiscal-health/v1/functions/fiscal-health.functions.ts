/**
 * Sprint 008.1 — Server functions do módulo Saúde Fiscal (Bella CFO).
 *
 * Isolado: não altera fiscal.functions.ts. Reusa `fiscal_settings`
 * (com colunas novas: annual_revenue_limit, fiscal_year_start_month,
 * alert_thresholds) e a tabela `fiscal_health_snapshots`.
 *
 * Fonte de faturamento: `sales` onde status = 'paid'.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCompanyId } from "@/lib/company-resolver.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import {
  computeFiscalHealth,
  type FiscalHealthResult,
  type HealthStatus,
} from "../service/fiscal-health.service";
import { getRegimeStrategy, type TaxRegime } from "../strategies/tax-regime-strategy";

type SB = SupabaseClient<Database>;

// ---------------------------------------------------------------- helpers



async function ensurePermission(
  supabase: SB,
  userId: string,
  companyId: string,
  code: "fiscal.view" | "fiscal.manage",
): Promise<void> {
  const { data, error } = await supabase.rpc("has_permission", {
    _user_id: userId,
    _company_id: companyId,
    _permission_code: code,
  });
  if (error) throw error;
  if (!data) throw new Error(`Acesso negado: ${code}`);
}

type SettingsRow = {
  company_id: string;
  tax_regime: TaxRegime | null;
  annual_revenue_limit: number | null;
  fiscal_year_start_month: number | null;
  alert_thresholds: number[] | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const settingsTable = (supabase: SB) => (supabase.from("fiscal_settings" as never) as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const snapshotsTable = (supabase: SB) => (supabase.from("fiscal_health_snapshots" as never) as any);

// ---------------------------------------------------------------- DTOs

export type FiscalHealthConfigDto = {
  companyId: string;
  regime: TaxRegime;
  annualRevenueLimit: number | null;
  fiscalYearStartMonth: number;
  alertThresholds: number[];
};

export type FiscalHealthDto = FiscalHealthResult & {
  companyId: string;
  fiscalYearStartMonth: number;
  fiscalYearStart: string; // YYYY-MM-DD
  monthlySeries: Array<{ month: string; revenue: number }>;
};

export type FiscalHealthSnapshotDto = {
  id: string;
  snapshotMonth: string;
  taxRegime: TaxRegime;
  annualLimit: number | null;
  ytdRevenue: number;
  monthlyRevenue: number;
  percentUsed: number | null;
  status: HealthStatus;
  projectionYearEnd: number | null;
  monthsElapsed: number;
  createdAt: string;
};

// ---------------------------------------------------------------- core

function fiscalYearWindow(startMonth: number, ref: Date): { start: Date; monthsElapsed: number } {
  const y = ref.getFullYear();
  const m = ref.getMonth() + 1; // 1..12
  const startYear = m >= startMonth ? y : y - 1;
  const start = new Date(startYear, startMonth - 1, 1);
  const monthsElapsed = (ref.getFullYear() - startYear) * 12 + (ref.getMonth() - (startMonth - 1)) + 1;
  return { start, monthsElapsed: Math.max(1, Math.min(12, monthsElapsed)) };
}

async function loadConfig(supabase: SB, companyId: string): Promise<FiscalHealthConfigDto> {
  const { data, error } = await settingsTable(supabase)
    .select("company_id, tax_regime, annual_revenue_limit, fiscal_year_start_month, alert_thresholds")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  const row = (data ?? null) as SettingsRow | null;
  const regime = (row?.tax_regime ?? "simples") as TaxRegime;
  const strategy = getRegimeStrategy(regime);
  return {
    companyId,
    regime,
    annualRevenueLimit: row?.annual_revenue_limit ?? strategy.defaultAnnualLimit,
    fiscalYearStartMonth: row?.fiscal_year_start_month ?? 1,
    alertThresholds: (row?.alert_thresholds ?? [...strategy.defaultAlertThresholds]) as number[],
  };
}

async function loadMonthlyRevenue(
  supabase: SB,
  companyId: string,
  fiscalStart: Date,
  monthsElapsed: number,
): Promise<Array<{ month: string; revenue: number }>> {
  const startIso = fiscalStart.toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("sales") as any)
    .select("grand_total, paid_at, sale_date, status")
    .eq("company_id", companyId)
    .eq("status", "paid")
    .gte("paid_at", startIso);
  if (error) throw error;

  const buckets = new Map<string, number>();
  for (let i = 0; i < monthsElapsed; i += 1) {
    const d = new Date(fiscalStart.getFullYear(), fiscalStart.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, 0);
  }
  for (const raw of (data ?? []) as Array<{ grand_total: number | null; paid_at: string | null }>) {
    if (!raw.paid_at) continue;
    const d = new Date(raw.paid_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!buckets.has(key)) continue;
    buckets.set(key, (buckets.get(key) ?? 0) + Number(raw.grand_total ?? 0));
  }
  return Array.from(buckets.entries()).map(([month, revenue]) => ({ month, revenue }));
}

// ---------------------------------------------------------------- server fns

export const getFiscalHealthConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FiscalHealthConfigDto> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.view");
    return loadConfig(supabase, companyId);
  });

const configSchema = z
  .object({
    regime: z.enum(["mei", "simples", "presumido", "real"]),
    annualRevenueLimit: z.number().nonnegative().nullable(),
    fiscalYearStartMonth: z.number().int().min(1).max(12),
    alertThresholds: z.array(z.number().min(1).max(200)).min(1).max(10),
  })
  .strict();

export const updateFiscalHealthConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof configSchema>) => configSchema.parse(input))
  .handler(async ({ data, context }): Promise<FiscalHealthConfigDto> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");

    // Upsert preservando outros campos: primeiro tenta update, senão insert com defaults do schema
    const sorted = [...data.alertThresholds].sort((a, b) => a - b);
    const { data: existing } = await settingsTable(supabase)
      .select("company_id")
      .eq("company_id", companyId)
      .maybeSingle();
    if (existing) {
      const { error } = await settingsTable(supabase)
        .update({
          tax_regime: data.regime,
          annual_revenue_limit: data.annualRevenueLimit,
          fiscal_year_start_month: data.fiscalYearStartMonth,
          alert_thresholds: sorted,
          updated_by: context.userId,
        })
        .eq("company_id", companyId);
      if (error) throw error;
    } else {
      const { error } = await settingsTable(supabase).insert({
        company_id: companyId,
        tax_regime: data.regime,
        annual_revenue_limit: data.annualRevenueLimit,
        fiscal_year_start_month: data.fiscalYearStartMonth,
        alert_thresholds: sorted,
        // defaults obrigatórios da tabela fiscal_settings existente:
        emit_uf: "SP",
        nfe_series: 1,
        nfe_next_number: 1,
        default_environment: "homologation",
        operation_nature: "Venda de mercadoria",
        default_cfop: "5102",
        updated_by: context.userId,
      });
      if (error) throw error;
    }
    return loadConfig(supabase, companyId);
  });

export const getFiscalHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FiscalHealthDto> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.view");

    const config = await loadConfig(supabase, companyId);
    const now = new Date();
    const { start, monthsElapsed } = fiscalYearWindow(config.fiscalYearStartMonth, now);
    const monthlySeries = await loadMonthlyRevenue(supabase, companyId, start, monthsElapsed);
    const ytdRevenue = monthlySeries.reduce((s, r) => s + r.revenue, 0);

    const result = computeFiscalHealth({
      regime: config.regime,
      annualLimit: config.annualRevenueLimit,
      ytdRevenue,
      monthsElapsed,
      monthlySeries,
      alertThresholds: config.alertThresholds,
    });

    return {
      ...result,
      companyId,
      fiscalYearStartMonth: config.fiscalYearStartMonth,
      fiscalYearStart: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`,
      monthlySeries,
    };
  });

export const getFiscalHealthHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FiscalHealthSnapshotDto[]> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.view");

    const { data, error } = await snapshotsTable(supabase)
      .select("id, snapshot_month, tax_regime, annual_limit, ytd_revenue, monthly_revenue, percent_used, status, projection_year_end, months_elapsed, created_at")
      .eq("company_id", companyId)
      .order("snapshot_month", { ascending: false })
      .limit(24);
    if (error) throw error;
    type Row = {
      id: string; snapshot_month: string; tax_regime: TaxRegime;
      annual_limit: number | null; ytd_revenue: number; monthly_revenue: number;
      percent_used: number | null; status: HealthStatus;
      projection_year_end: number | null; months_elapsed: number; created_at: string;
    };
    return ((data ?? []) as Row[]).map((r) => ({
      id: r.id,
      snapshotMonth: r.snapshot_month,
      taxRegime: r.tax_regime,
      annualLimit: r.annual_limit,
      ytdRevenue: Number(r.ytd_revenue),
      monthlyRevenue: Number(r.monthly_revenue),
      percentUsed: r.percent_used != null ? Number(r.percent_used) : null,
      status: r.status,
      projectionYearEnd: r.projection_year_end != null ? Number(r.projection_year_end) : null,
      monthsElapsed: r.months_elapsed,
      createdAt: r.created_at,
    }));
  });

export const recordFiscalHealthSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FiscalHealthSnapshotDto> => {
    const supabase = context.supabase as SB;
    const companyId = await resolveCompanyId(supabase, context.userId);
    await ensurePermission(supabase, context.userId, companyId, "fiscal.manage");

    const config = await loadConfig(supabase, companyId);
    const now = new Date();
    const { start, monthsElapsed } = fiscalYearWindow(config.fiscalYearStartMonth, now);
    const monthlySeries = await loadMonthlyRevenue(supabase, companyId, start, monthsElapsed);
    const ytdRevenue = monthlySeries.reduce((s, r) => s + r.revenue, 0);
    const monthlyRevenue = monthlySeries[monthlySeries.length - 1]?.revenue ?? 0;

    const result = computeFiscalHealth({
      regime: config.regime,
      annualLimit: config.annualRevenueLimit,
      ytdRevenue,
      monthsElapsed,
      monthlySeries,
      alertThresholds: config.alertThresholds,
    });

    const snapshotMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const payload = {
      company_id: companyId,
      snapshot_month: snapshotMonth,
      tax_regime: config.regime,
      annual_limit: result.annualLimit,
      ytd_revenue: ytdRevenue,
      monthly_revenue: monthlyRevenue,
      percent_used: result.percentUsed,
      status: result.status,
      projection_year_end: result.projectionYearEnd,
      months_elapsed: monthsElapsed,
    };
    const { data, error } = await snapshotsTable(supabase)
      .upsert(payload, { onConflict: "company_id,snapshot_month" })
      .select("*")
      .single();
    if (error) throw error;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = data as any;
    return {
      id: r.id,
      snapshotMonth: r.snapshot_month,
      taxRegime: r.tax_regime,
      annualLimit: r.annual_limit,
      ytdRevenue: Number(r.ytd_revenue),
      monthlyRevenue: Number(r.monthly_revenue),
      percentUsed: r.percent_used != null ? Number(r.percent_used) : null,
      status: r.status,
      projectionYearEnd: r.projection_year_end != null ? Number(r.projection_year_end) : null,
      monthsElapsed: r.months_elapsed,
      createdAt: r.created_at,
    };
  });
