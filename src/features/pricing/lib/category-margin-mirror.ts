/**
 * Espelho da política de categoria nas colunas de `product_categories`.
 * ======================================================================
 * O Motor Comercial V2 (`fetchPricingInputs`) lê as margens da categoria
 * diretamente de `product_categories`. A tela de Políticas por Categoria
 * grava a política versionada em `category_pricing_policies`.
 *
 * Para que UI e motor NUNCA divirjam, toda gravação de política espelha
 * as margens nessas colunas. Aqui vive apenas o mapeamento (puro).
 */
export interface CategoryMarginPolicyLike {
  minMarginPct?: number | null;
  idealMarginPct?: number | null;
  premiumMarginPct?: number | null;
}

export interface CategoryMarginColumns {
  min_margin_pct: number | null;
  target_margin_pct: number | null;
  max_margin_pct: number | null;
}

const pct = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n >= 100) return null;
  return Math.round(n * 100) / 100;
};

/**
 * Traduz a política (margem mínima / padrão / máxima) para as colunas lidas
 * pelo motor. `premiumMarginPct` é a margem MÁXIMA da categoria.
 */
export function categoryMarginColumns(policy: CategoryMarginPolicyLike): CategoryMarginColumns {
  const min = pct(policy.minMarginPct);
  const target = pct(policy.idealMarginPct);
  const max = pct(policy.premiumMarginPct);
  return {
    min_margin_pct: min,
    target_margin_pct: target,
    // Coerência: máxima nunca abaixo da padrão.
    max_margin_pct: max != null && target != null && max < target ? target : max,
  };
}
