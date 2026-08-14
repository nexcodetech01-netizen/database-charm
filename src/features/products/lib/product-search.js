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
const TEXT_COLS = ["name", "sku", "barcode", "brand", "description"];
export function normalizeSearchTerm(input) {
    if (!input)
        return [];
    return input
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[(),*"']/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
}
/**
 * Aplica a busca inteligente sobre uma query de `products` já criada.
 * Retorna a mesma query para permitir chaining.
 */
export function applyProductSearch(query, term, options) {
    const words = normalizeSearchTerm(term);
    let q = query;
    if (options?.salesChannel) {
        q = q.contains("sales_channels", [options.salesChannel]);
    }
    for (const w of words) {
        const like = `%${w}%`;
        const parts = TEXT_COLS.map((c) => `${c}.ilike.${like}`);
        parts.push(`tags.cs.{${w}}`);
        q = q.or(parts.join(","));
    }
    return q;
}
