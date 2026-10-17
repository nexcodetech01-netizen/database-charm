/**
 * Identidade de um produto para o aviso de "duplicado".
 *
 * O nome sozinho não identifica uma peça: duas "Camiseta Nike Azul" podem
 * ser estampas ou tamanhos diferentes. Como nos sistemas grandes, a
 * identidade é o conjunto nome + modelo + cor + tamanho (e o código de
 * barras/SKU, que já são únicos no banco).
 */

/** Valores-padrão antigos do cadastro que não dizem nada sobre a peça. */
const PLACEHOLDERS = new Set(["generico", "generica", "padrao", "-", "n/a", "na"]);

export const SIZE_SUGGESTIONS = [
  "PP", "P", "M", "G", "GG", "XG", "XGG", "EG",
  "34", "36", "38", "40", "42", "44", "46", "48",
  "Único",
];

/** minúsculas, sem acento, espaços simples. */
export function normalizeAttr(value: string | null | undefined): string {
  const v = (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, " ")
    .trim();
  return PLACEHOLDERS.has(v) ? "" : v;
}

export interface ProductIdentity {
  name?: string | null;
  model?: string | null;
  color?: string | null;
  size?: string | null;
}

/**
 * Duas peças só são "a mesma" se nome, modelo, cor e tamanho baterem.
 * Campo em branco num dos lados não conta como diferença (cadastro antigo
 * sem cor/tamanho ainda pode ser o mesmo produto) — por isso é só aviso.
 */
export function sameProductIdentity(a: ProductIdentity, b: ProductIdentity): boolean {
  if (normalizeAttr(a.name) !== normalizeAttr(b.name)) return false;
  for (const k of ["model", "color", "size"] as const) {
    const x = normalizeAttr(a[k]);
    const y = normalizeAttr(b[k]);
    if (x && y && x !== y) return false;
  }
  return true;
}

/** "Azul · M" — para mostrar ao lado do nome em listas e sugestões. */
export function describeVariant(p: { model?: string | null; color?: string | null; size?: string | null }): string {
  const parts = [p.model, p.color, p.size]
    .map((v) => (v ?? "").trim())
    .filter((v) => v && normalizeAttr(v));
  return parts.join(" · ");
}

/**
 * Completa o nome com o que falta (marca, modelo, cor, tamanho), sem
 * repetir o que já está escrito. Ex.: "Camiseta" + Nike/Just Do It/Azul/M
 * → "Camiseta Nike Just Do It Azul M".
 */
export function buildProductName(input: {
  name?: string | null;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  size?: string | null;
}): string {
  let name = (input.name ?? "").trim().replace(/\s+/g, " ");
  const has = (part: string) => ` ${normalizeAttr(name)} `.includes(` ${normalizeAttr(part)} `);
  for (const raw of [input.brand, input.model, input.color, input.size]) {
    const part = (raw ?? "").trim();
    if (!part || !normalizeAttr(part) || has(part)) continue;
    name = name ? `${name} ${part}` : part;
  }
  return name;
}
