/**
 * Company operational cost defaults
 * =================================
 * Central helper para carregar e aplicar os custos operacionais padrão
 * cadastrados em `public.companies` (default_freight / default_packaging /
 * default_insurance / default_other_costs).
 *
 * Regra (definida pelo Tech Lead):
 *  - Se o produto possuir valor próprio (> 0), ele prevalece.
 *  - Se o produto não possuir valor próprio (`null` ou `0`), usa-se o
 *    default da empresa (que também pode ser `0`).
 *
 * NÃO altera o Pricing Engine — apenas monta o input de custo antes de
 * chamar `composeCostComponents` / `composeCostComposition`.
 */
export interface CompanyCostDefaults {
  readonly freight: number;
  readonly packaging: number;
  readonly insurance: number;
  readonly otherCosts: number;
}

export const EMPTY_COMPANY_COST_DEFAULTS: CompanyCostDefaults = {
  freight: 0,
  packaging: 0,
  insurance: 0,
  otherCosts: 0,
};

const toN = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Fetch defaults from `public.companies`. Never throws — returns zeros on error. */
export async function fetchCompanyCostDefaults(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  companyId: string,
): Promise<CompanyCostDefaults> {
  const res = await supabase
    .from("companies")
    .select("default_freight, default_packaging, default_insurance, default_other_costs")
    .eq("id", companyId)
    .maybeSingle();
  if (res.error || !res.data) return EMPTY_COMPANY_COST_DEFAULTS;
  return {
    freight: toN(res.data.default_freight),
    packaging: toN(res.data.default_packaging),
    insurance: toN(res.data.default_insurance),
    otherCosts: toN(res.data.default_other_costs),
  };
}

interface RawCosts {
  readonly freight: number | string | null;
  readonly packaging: number | string | null;
  readonly insurance: number | string | null;
  readonly other_costs: number | string | null;
}

/**
 * Aplica COALESCE(produto, empresa) tratando `null`/`0` como "sem valor
 * próprio no produto". Se o produto tiver `> 0`, prevalece.
 */
export function mergeProductOperationalCosts(
  product: RawCosts,
  defaults: CompanyCostDefaults,
): {
  readonly freight: number;
  readonly packaging: number;
  readonly insurance: number;
  readonly otherCosts: number;
} {
  const pFreight = toN(product.freight);
  const pPackaging = toN(product.packaging);
  const pInsurance = toN(product.insurance);
  const pOthers = toN(product.other_costs);
  return {
    freight: pFreight > 0 ? pFreight : defaults.freight,
    packaging: pPackaging > 0 ? pPackaging : defaults.packaging,
    insurance: pInsurance > 0 ? pInsurance : defaults.insurance,
    otherCosts: pOthers > 0 ? pOthers : defaults.otherCosts,
  };
}
