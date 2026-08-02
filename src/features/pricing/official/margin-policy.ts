/**
 * POLÍTICA DE MARGEM — resolução oficial e auditável
 * ==================================================
 * Fonte ÚNICA de verdade para responder duas perguntas:
 *
 *   1. Qual margem o Motor Comercial V2 deve usar neste produto?
 *   2. De ONDE veio essa margem (auditoria)?
 *
 * Hierarquia:
 *   produto (margem própria)  →  categoria (política automática ativa)
 *   →  empresa (política comercial)  →  fallback canônico
 *
 * PURO — sem I/O, sem percentual hardcoded (o fallback chega por parâmetro).
 */

export type MarginOrigin = "product" | "category" | "company" | "fallback";

export interface CategoryMarginPolicy {
  /** Margem padrão (%) da categoria. */
  readonly targetPct?: number | null;
  readonly minPct?: number | null;
  readonly maxPct?: number | null;
  /** "Utilizar política automática" — quando false a categoria não impõe margem. */
  readonly autoPolicy?: boolean | null;
}

export interface ProductMarginOverride {
  /** Margem informada apenas neste produto (%). */
  readonly marginPct?: number | null;
  /** true = herdar da categoria; false = usar a margem própria. */
  readonly useCategoryMargin?: boolean | null;
}

export interface MarginResolution {
  /** Margem efetiva (%) a ser usada pelo motor. */
  readonly marginPct: number;
  /** Origem para a auditoria do produto. */
  readonly origin: MarginOrigin;
  /** Rótulo pt-BR pronto para a UI de auditoria. */
  readonly originLabel: string;
  /** Margem mínima aplicável (%), quando conhecida. */
  readonly minPct: number | null;
  /** Margem máxima aplicável (%), quando conhecida. */
  readonly maxPct: number | null;
  /** true quando a margem foi ajustada para respeitar mínima/máxima. */
  readonly clamped: boolean;
}

export const MARGIN_ORIGIN_LABEL: Record<MarginOrigin, string> = {
  product: "Produto",
  category: "Categoria",
  company: "Empresa",
  fallback: "Padrão do sistema",
};

const pct = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n >= 100) return null;
  return n;
};

/** true quando a categoria tem política automática utilizável. */
export function categoryPolicyIsActive(category: CategoryMarginPolicy | null | undefined): boolean {
  if (!category) return false;
  if (category.autoPolicy === false) return false;
  return pct(category.targetPct) != null;
}

/**
 * Resolve a margem efetiva e sua origem.
 *
 * - `product.marginPct` só vence quando `useCategoryMargin !== true`.
 * - A categoria só entra quando `autoPolicy` não estiver desligada.
 * - Mínima/máxima da categoria limitam qualquer margem (inclusive a própria
 *   do produto), sinalizando `clamped` para a auditoria.
 */
export function resolveMarginPolicy(params: {
  product?: ProductMarginOverride | null;
  category?: CategoryMarginPolicy | null;
  companyTargetPct?: number | null;
  fallbackTargetPct: number;
}): MarginResolution {
  const { product, category, companyTargetPct, fallbackTargetPct } = params;

  const categoryActive = categoryPolicyIsActive(category);
  const minPct = categoryActive ? pct(category?.minPct) : null;
  const maxPct = categoryActive ? pct(category?.maxPct) : null;

  const own = product?.useCategoryMargin === true ? null : pct(product?.marginPct);

  let base: number;
  let origin: MarginOrigin;

  if (own != null && own > 0) {
    base = own;
    origin = "product";
  } else if (categoryActive) {
    base = pct(category?.targetPct) as number;
    origin = "category";
  } else if (pct(companyTargetPct) != null) {
    base = pct(companyTargetPct) as number;
    origin = "company";
  } else {
    base = fallbackTargetPct;
    origin = "fallback";
  }

  let marginPct = base;
  if (minPct != null && marginPct < minPct) marginPct = minPct;
  if (maxPct != null && marginPct > maxPct) marginPct = maxPct;

  return {
    marginPct,
    origin,
    originLabel: MARGIN_ORIGIN_LABEL[origin],
    minPct,
    maxPct,
    clamped: marginPct !== base,
  };
}
