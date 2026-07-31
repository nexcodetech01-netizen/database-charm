/**
 * Motor Tributário — service.
 *
 * Camada única de acesso ao motor tributário do banco. Todas as regras
 * de cálculo, apuração e integração contábil vivem em RPCs; aqui só há
 * mapeamento de tipos. Nenhum dado é mockado.
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  CompanyTaxProfile,
  CompanyTaxProfileInput,
  SimplesAnnex,
  SimplesComputation,
  TaxApportionment,
  TaxProjection,
  TaxRegime,
  TaxScenario,
} from "../types";

type Json = Record<string, unknown>;

const num = (v: unknown): number => {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? Number(n) : 0;
};

const str = (v: unknown): string => (v == null ? "" : String(v));

/* eslint-disable @typescript-eslint/no-explicit-any */
const rpc = (name: string, args: Json) =>
  (supabase as any).rpc(name, args) as Promise<{ data: unknown; error: { message: string } | null }>;
const table = (name: string) => (supabase as any).from(name);
/* eslint-enable @typescript-eslint/no-explicit-any */

function mapProfile(row: Json): CompanyTaxProfile {
  return {
    id: str(row.id),
    companyId: str(row.company_id),
    taxRegime: str(row.tax_regime) as TaxRegime,
    simplesAnnex: (row.simples_annex as SimplesAnnex) ?? null,
    rbt12: num(row.rbt12),
    effectiveRate: num(row.effective_rate),
    nominalRate: num(row.nominal_rate),
    icmsRegime: str(row.icms_regime),
    pisRegime: str(row.pis_regime),
    cofinsRegime: str(row.cofins_regime),
    issRegime: str(row.iss_regime),
    ipiRegime: str(row.ipi_regime),
    dueDay: num(row.due_day) || 20,
    startDate: str(row.start_date),
    active: Boolean(row.active),
  };
}

function mapApportionment(row: Json): TaxApportionment {
  return {
    id: str(row.id),
    companyId: str(row.company_id),
    competence: str(row.competence),
    taxRegime: str(row.tax_regime) as TaxRegime,
    simplesAnnex: (row.simples_annex as SimplesAnnex) ?? null,
    bracket: row.bracket == null ? null : num(row.bracket),
    revenue: num(row.revenue),
    baseAmount: num(row.base_amount),
    rbt12: num(row.rbt12),
    nominalRate: num(row.nominal_rate),
    deduction: num(row.deduction),
    effectiveRate: num(row.effective_rate),
    taxAmount: num(row.tax_amount),
    dueDate: row.due_date ? str(row.due_date) : null,
    status: str(row.status) as TaxApportionment["status"],
    entryId: row.entry_id ? str(row.entry_id) : null,
  };
}

function mapScenario(raw: Json): TaxScenario {
  return {
    growthPct: num(raw.growth_pct),
    revenue: num(raw.revenue),
    taxAmount: num(raw.tax_amount),
    effectiveRate: num(raw.effective_rate),
    bracket: raw.bracket == null ? null : num(raw.bracket),
    cogs: num(raw.cogs),
    operatingExpenses: num(raw.operating_expenses),
    netProfit: num(raw.net_profit),
    netMargin: num(raw.net_margin),
  };
}

/** Primeiro dia do mês (YYYY-MM-01) de uma data/competência. */
export function toCompetence(date: string | Date = new Date()): string {
  const d = typeof date === "string" ? new Date(`${date.slice(0, 10)}T00:00:00`) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export const taxService = {
  /* ---------- Perfil tributário ---------- */

  async getProfile(companyId: string): Promise<CompanyTaxProfile | null> {
    const { data, error } = await table("company_tax_profile")
      .select("*")
      .eq("company_id", companyId)
      .eq("active", true)
      .maybeSingle();
    if (error) throw error;
    return data ? mapProfile(data as Json) : null;
  },

  async upsertProfile(
    companyId: string,
    input: CompanyTaxProfileInput,
  ): Promise<CompanyTaxProfile> {
    const existing = await this.getProfile(companyId);
    const payload: Json = {
      company_id: companyId,
      tax_regime: input.taxRegime,
      simples_annex: input.simplesAnnex ?? null,
      icms_regime: input.icmsRegime ?? "simples",
      pis_regime: input.pisRegime ?? "simples",
      cofins_regime: input.cofinsRegime ?? "simples",
      iss_regime: input.issRegime ?? "nao_aplicavel",
      ipi_regime: input.ipiRegime ?? "nao_aplicavel",
      due_day: input.dueDay ?? 20,
      active: input.active ?? true,
    };
    if (input.startDate) payload.start_date = input.startDate;
    if (input.effectiveRate != null) payload.effective_rate = input.effectiveRate;
    if (input.nominalRate != null) payload.nominal_rate = input.nominalRate;

    const query = existing
      ? table("company_tax_profile").update(payload).eq("id", existing.id).select("*").single()
      : table("company_tax_profile").insert(payload).select("*").single();

    const { data, error } = await query;
    if (error) throw error;
    return mapProfile(data as Json);
  },

  /* ---------- Bases reais ---------- */

  async rbt12(companyId: string, competence = toCompetence()): Promise<number> {
    const { data, error } = await rpc("company_rbt12", {
      _company_id: companyId,
      _competence: toCompetence(competence),
    });
    if (error) throw error;
    return num(data);
  },

  async monthlyRevenue(companyId: string, competence = toCompetence()): Promise<number> {
    const { data, error } = await rpc("company_monthly_revenue", {
      _company_id: companyId,
      _competence: toCompetence(competence),
    });
    if (error) throw error;
    return num(data);
  },

  /* ---------- Motor do Simples ---------- */

  async simulateSimples(
    annex: SimplesAnnex,
    rbt12: number,
    revenue: number,
  ): Promise<SimplesComputation> {
    const { data, error } = await rpc("simples_compute", {
      _annex: annex,
      _rbt12: rbt12,
      _revenue: revenue,
    });
    if (error) throw error;
    const raw = (data ?? {}) as Json;
    return {
      annex: str(raw.annex) as SimplesAnnex,
      bracket: num(raw.bracket),
      rbt12: num(raw.rbt12),
      revenue: num(raw.revenue),
      nominalRate: num(raw.nominal_rate),
      deduction: num(raw.deduction),
      effectiveRate: num(raw.effective_rate),
      taxAmount: num(raw.tax_amount),
      limitUsagePct: num(raw.limit_usage_pct),
    };
  },

  /* ---------- Apuração ---------- */

  async generateApportionment(
    companyId: string,
    competence = toCompetence(),
    close = false,
  ): Promise<TaxApportionment> {
    const { data, error } = await rpc("generate_tax_apportionment", {
      _company_id: companyId,
      _competence: toCompetence(competence),
      _close: close,
    });
    if (error) throw error;
    const raw = (data ?? {}) as Json;
    return mapApportionment({ ...raw, company_id: companyId, simples_annex: raw.annex });
  },

  async listApportionments(companyId: string, limit = 24): Promise<TaxApportionment[]> {
    const { data, error } = await table("tax_apportionments")
      .select("*")
      .eq("company_id", companyId)
      .order("competence", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return ((data ?? []) as Json[]).map(mapApportionment);
  },

  async getApportionment(
    companyId: string,
    competence: string,
  ): Promise<TaxApportionment | null> {
    const { data, error } = await table("tax_apportionments")
      .select("*")
      .eq("company_id", companyId)
      .eq("competence", toCompetence(competence))
      .maybeSingle();
    if (error) throw error;
    return data ? mapApportionment(data as Json) : null;
  },

  async markAsPaid(id: string): Promise<void> {
    const { error } = await table("tax_apportionments").update({ status: "paid" }).eq("id", id);
    if (error) throw error;
  },

  /* ---------- Projeções ---------- */

  async projectScenarios(
    companyId: string,
    competence = toCompetence(),
    growths = [0, 10, 20, 30],
  ): Promise<TaxProjection> {
    const { data, error } = await rpc("project_tax_scenarios", {
      _company_id: companyId,
      _competence: toCompetence(competence),
      _growth: growths,
    });
    if (error) throw error;
    const raw = (data ?? {}) as Json;
    return {
      competence: str(raw.competence),
      baseRevenue: num(raw.base_revenue),
      rbt12: num(raw.rbt12),
      scenarios: Array.isArray(raw.scenarios)
        ? (raw.scenarios as Json[]).map(mapScenario)
        : [],
    };
  },
};

export type TaxService = typeof taxService;
