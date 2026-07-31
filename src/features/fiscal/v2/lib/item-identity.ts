/**
 * Fiscal v2 — Identificação comercial do item na NF-e.
 *
 * Sprint P0.6.3 (conformidade de representação):
 *  - `codigo_produto` deve ser o SKU cadastrado. UUID só é usado como
 *    último recurso, quando o produto não possui SKU.
 *  - `unidade_comercial` deve refletir a unidade cadastrada no produto
 *    (UN, CX, KG, MT, PC, L...), nunca um valor fixo.
 *
 * Nenhuma regra tributária é alterada aqui.
 */

/** Unidade padrão quando o produto não possui unidade cadastrada. */
export const DEFAULT_COMMERCIAL_UNIT = "UN";

/** Limite do campo cProd na NF-e. */
const CODE_MAX_LENGTH = 60;
/** Limite do campo uCom/uTrib na NF-e. */
const UNIT_MAX_LENGTH = 6;

/**
 * Código comercial do item: SKU quando disponível, senão o identificador
 * interno do produto (comportamento atual preservado).
 */
export function resolveCommercialCode(
  sku: string | null | undefined,
  fallback: string,
): string {
  const clean = typeof sku === "string" ? sku.trim() : "";
  if (clean.length > 0) return clean.slice(0, CODE_MAX_LENGTH);
  return String(fallback ?? "").slice(0, CODE_MAX_LENGTH);
}

/**
 * Unidade comercial normalizada (maiúscula, sem espaços/acentos),
 * limitada a 6 caracteres. Ausente → "UN".
 */
export function resolveCommercialUnit(unit: string | null | undefined): string {
  if (typeof unit !== "string") return DEFAULT_COMMERCIAL_UNIT;
  const clean = unit
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .trim();
  if (clean.length === 0) return DEFAULT_COMMERCIAL_UNIT;
  return clean.slice(0, UNIT_MAX_LENGTH);
}
