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

export interface DuplicateCandidate {
  name?: string | null;
  sku?: string | null;
  barcode?: string | null;
}

export interface DuplicateProduct {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number | null;
  cost: number | null;
  matchedBy: "sku" | "barcode" | "name";
}

/** Normaliza texto para comparação: trim, colapso de espaços e minúsculas. */
export function normalizeForMatch(value?: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Escapa curingas do LIKE para permitir comparação exata via `ilike`. */
function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, (m) => `\\${m}`);
}

/**
 * Busca um produto existente equivalente. Precedência: SKU → Código de barras → Nome.
 * Retorna `null` quando não há duplicidade.
 */
export async function findDuplicateProduct(
  companyId: string,
  candidate: DuplicateCandidate,
  ignoreProductId?: string,
): Promise<DuplicateProduct | null> {
  if (!companyId) return null;

  const checks: Array<{ column: "sku" | "barcode" | "name"; value: string }> = [];
  const sku = (candidate.sku ?? "").trim();
  const barcode = (candidate.barcode ?? "").trim();
  const name = normalizeForMatch(candidate.name);

  if (sku) checks.push({ column: "sku", value: sku });
  if (barcode) checks.push({ column: "barcode", value: barcode });
  if (name) checks.push({ column: "name", value: name });
  if (checks.length === 0) return null;

  for (const check of checks) {
    let q = supabase
      .from("products")
      .select("id, name, sku, barcode")
      .eq("company_id", companyId)
      .ilike(check.column, escapeLike(check.value))
      .order("created_at", { ascending: true })
      .limit(1);

    if (ignoreProductId) q = q.neq("id", ignoreProductId);

    const { data, error } = await q;
    if (error) return null;
    const row = (data ?? [])[0];
    if (row) {
      return {
        id: row.id,
        name: row.name,
        sku: row.sku ?? null,
        barcode: row.barcode ?? null,
        matchedBy: check.column,
      };
    }
  }

  return null;
}
