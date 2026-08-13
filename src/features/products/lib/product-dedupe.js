/**
 * Deduplicação de produtos (UPSERT).
 *
 * Regra única do NexOS: antes de criar um produto (formulário, importação de
 * PDF/Foto/XML ou Skills da Bella) verificamos se já existe um produto na
 * mesma empresa com o MESMO Nome OU SKU OU Código de Barras — comparação
 * case-insensitive e ignorando espaços extras.
 *
 * Este módulo NÃO altera estoque: o saldo continua sendo movimentado
 * exclusivamente pelo motor oficial (`inventory_movements`).
 */
import { supabase } from "@/integrations/supabase/client";
/** Normaliza texto para comparação: trim, hífens/travessões como espaço, colapso e minúsculas. */
export function normalizeForMatch(value) {
    return (value ?? "")
        .replace(/[-–—]/g, " ")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}
/** Escapa curingas do LIKE para permitir comparação exata via `ilike`. */
function escapeLike(value) {
    return value.replace(/[%_\\]/g, (m) => `\\${m}`);
}
/**
 * Padrão `ilike` para nomes: separadores (espaços, hífens e travessões)
 * viram curinga, de modo que "Arthur - Preto" case com "Arthur — Preto".
 */
function namePattern(normalized) {
    return escapeLike(normalized).split(" ").filter(Boolean).join("%");
}
/**
 * Busca um produto existente equivalente. Precedência: SKU → Código de barras → Nome.
 * Retorna `null` quando não há duplicidade.
 *
 * `client` permite reaproveitar a deduplicação com um client autenticado
 * por contexto (Skills da Bella). Por padrão usa o client da aplicação.
 */
export async function findDuplicateProduct(companyId, candidate, ignoreProductId, 
// eslint-disable-next-line @typescript-eslint/no-explicit-any
client = supabase) {
    if (!companyId)
        return null;
    const checks = [];
    const sku = (candidate.sku ?? "").trim();
    const barcode = (candidate.barcode ?? "").trim();
    const name = normalizeForMatch(candidate.name);
    if (sku)
        checks.push({ column: "sku", value: escapeLike(sku) });
    if (barcode)
        checks.push({ column: "barcode", value: escapeLike(barcode) });
    if (name)
        checks.push({ column: "name", value: namePattern(name) });
    if (checks.length === 0)
        return null;
    for (const check of checks) {
        let q = client
            .from("products")
            .select("id, name, sku, barcode, price, cost")
            .eq("company_id", companyId)
            .ilike(check.column, check.value)
            .order("created_at", { ascending: true })
            .limit(1);
        if (ignoreProductId)
            q = q.neq("id", ignoreProductId);
        const { data, error } = await q;
        if (error)
            return null;
        const row = (data ?? [])[0];
        if (row) {
            return {
                id: row.id,
                name: row.name,
                sku: row.sku ?? null,
                barcode: row.barcode ?? null,
                price: row.price ?? null,
                cost: row.cost ?? null,
                matchedBy: check.column,
            };
        }
    }
    return null;
}
