/**
 * Busca inteligente de produtos (SEARCH-001).
 *
 * Estratégia única compartilhada por Produtos, Vendas, Compras, Central de
 * Vendas e Bella IA. Nenhuma alteração de banco/índice/serviço — só combina
 * `ilike` sobre colunas existentes com `.or()` do PostgREST.
 *
 * - Normaliza acentos, caixa e espaços.
 * - Multi-palavra: cada palavra é um `.or(...)` (chained = AND).
 * - Colunas cobertas: name, sku, barcode, brand, description, category (join),
 *   tags (containment exato do elemento).
 */

const TEXT_COLS = ["name", "sku", "barcode", "brand", "description"] as const;

export function normalizeSearchTerm(input: string): string[] {
  if (!input) return [];
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[(),*"']/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

type Filterable = {
  or: (filter: string, options?: { referencedTable?: string }) => Filterable;
};

/**
 * Aplica a busca inteligente sobre uma query de `products` já criada.
 * Retorna a mesma query para permitir chaining.
 */
export function applyProductSearch<Q extends Filterable>(
  query: Q,
  term: string,
  options?: { salesChannel?: string },
): Q {
  const words = normalizeSearchTerm(term);
  let q: Filterable = query;

  if (options?.salesChannel) {
    q = (q as any).contains("sales_channels", [options.salesChannel]);
  }

  for (const w of words) {
    const like = `%${w}%`;
    const parts = TEXT_COLS.map((c) => `${c}.ilike.${like}`);
    parts.push(`tags.cs.{${w}}`);
    q = q.or(parts.join(","));
  }
  return q as Q;
}
