/**
 * Entradas oficiais de precificação (Motor Comercial V2)
 * ======================================================
 * Carrega, em UM único lugar, tudo que o motor precisa para formar preço:
 *
 *   - margens: política da CATEGORIA → política da EMPRESA (fallback)
 *   - taxas reais do Asaas (`payment_method_fees`) + política de parcelamento
 *   - alíquota efetiva de impostos (`company_tax_profile`, quando configurada)
 *   - custos operacionais padrão da empresa (`companies.default_*`)
 *
 * Nenhum percentual é hardcoded aqui: os únicos valores fixos são os
 * fallbacks canônicos de `DEFAULT_POLICY`, usados apenas quando a empresa
 * ainda não configurou nenhuma política.
 */
import { buildFeeTable, EMPTY_FEE_TABLE, type CompanyFeeTable } from "../official/fees";
import type { OfficialMarginInput } from "../official/official-pricing";
import { DEFAULT_POLICY } from "../types";
import {
  EMPTY_COMPANY_COST_DEFAULTS,
  fetchCompanyCostDefaults,
  type CompanyCostDefaults,
} from "./../lib/company-cost-defaults";

/* eslint-disable @typescript-eslint/no-explicit-any */
type SupabaseLike = any;

export type MarginSource = "category" | "company" | "fallback";

export interface PricingInputs {
  readonly margins: OfficialMarginInput;
  readonly marginSource: MarginSource;
  readonly feeTable: CompanyFeeTable;
  /** Alíquota efetiva sobre a venda (%). 0 quando não configurada. */
  readonly taxPct: number;
  readonly costDefaults: CompanyCostDefaults;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const FALLBACK_MARGINS: OfficialMarginInput = {
  minPct: DEFAULT_POLICY.minMargin,
  targetPct: DEFAULT_POLICY.idealMargin,
  premiumPct: DEFAULT_POLICY.premiumMargin,
};

/** Resolve margens: categoria vence empresa; empresa vence fallback. */
export function resolveMargins(
  company: { minPct?: number | null; targetPct?: number | null; premiumPct?: number | null } | null,
  category: { minPct?: number | null; targetPct?: number | null; maxPct?: number | null } | null,
): { margins: OfficialMarginInput; source: MarginSource } {
  const companyMargins: OfficialMarginInput = {
    minPct: num(company?.minPct) ?? FALLBACK_MARGINS.minPct,
    targetPct: num(company?.targetPct) ?? FALLBACK_MARGINS.targetPct,
    premiumPct: num(company?.premiumPct) ?? FALLBACK_MARGINS.premiumPct,
  };

  const catTarget = num(category?.targetPct);
  const catMin = num(category?.minPct);
  const catMax = num(category?.maxPct);

  if (catTarget == null && catMin == null && catMax == null) {
    const source: MarginSource = num(company?.targetPct) != null ? "company" : "fallback";
    return { margins: companyMargins, source };
  }

  return {
    margins: {
      minPct: catMin ?? companyMargins.minPct,
      targetPct: catTarget ?? companyMargins.targetPct,
      premiumPct: companyMargins.premiumPct,
      ...(catMax != null ? { maxPct: catMax } : {}),
    },
    source: "category",
  };
}

/** Carrega as entradas oficiais. Nunca lança — degrada para fallbacks. */
export async function fetchPricingInputs(
  supabase: SupabaseLike,
  companyId: string,
  categoryId?: string | null,
): Promise<PricingInputs> {
  const [companyPolicyRes, categoryRes, feesRes, taxRes, costDefaults] = await Promise.all([
    supabase
      .from("company_pricing_policies")
      .select("envelope")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    categoryId
      ? supabase
          .from("product_categories")
          .select("target_margin_pct, min_margin_pct, max_margin_pct")
          .eq("id", categoryId)
          .eq("company_id", companyId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("payment_method_fees")
      .select("method_key, label, installments, fee_percent, fee_fixed, active")
      .eq("company_id", companyId),
    supabase
      .from("company_tax_profile")
      .select("effective_rate, active")
      .eq("company_id", companyId)
      .eq("active", true)
      .maybeSingle(),
    fetchCompanyCostDefaults(supabase, companyId).catch(() => EMPTY_COMPANY_COST_DEFAULTS),
  ]);

  const defaults = (
    companyPolicyRes?.data?.envelope as { payload?: { defaults?: Record<string, unknown> } } | null
  )?.payload?.defaults;

  const { margins, source } = resolveMargins(
    defaults
      ? {
          minPct: num(defaults["minMarginPct"]),
          targetPct: num(defaults["idealMarginPct"]),
          premiumPct: num(defaults["premiumMarginPct"]),
        }
      : null,
    categoryRes?.data
      ? {
          minPct: num(categoryRes.data.min_margin_pct),
          targetPct: num(categoryRes.data.target_margin_pct),
          maxPct: num(categoryRes.data.max_margin_pct),
        }
      : null,
  );

  const feeTable = feesRes?.data?.length ? buildFeeTable(feesRes.data) : EMPTY_FEE_TABLE;
  const taxPct = Math.max(0, num(taxRes?.data?.effective_rate) ?? 0);

  return {
    margins,
    marginSource: source,
    feeTable,
    taxPct,
    costDefaults: costDefaults ?? EMPTY_COMPANY_COST_DEFAULTS,
  };
}
