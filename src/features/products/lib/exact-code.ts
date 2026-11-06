import { hasRealBarcode } from "./barcode";

/**
 * Busca por código: se o termo é exatamente o SKU ou o código de barras de
 * algum produto, devolve só esses (a busca tolerante a erro trazia também
 * peças parecidas, ex.: CAM-MAS-PRE-005 → CAM-MAS-M-005, CAM-MAS-G-005...).
 * Sem acerto exato, devolve a lista como veio.
 */
export function preferExactCodeMatch<T extends { sku?: string | null; barcode?: string | null }>(
  rows: T[],
  term: string,
): T[] {
  const t = term.trim();
  if (t.length < 3) return rows;
  const tl = t.toLowerCase();
  const exact = rows.filter((r) => {
    if ((r.sku ?? "").trim().toLowerCase() === tl) return true;
    return hasRealBarcode(r.barcode) && (r.barcode ?? "").trim() === t;
  });
  return exact.length > 0 ? exact : rows;
}
