/** Código usado para produtos que não têm GTIN real. Preserve NULL/vazio legado. */
export const NO_BARCODE = "SEM GTIN";

const missingCodes = new Set(["ISENTO", "SEM CODIGO", "SEM EAN", "SEM GTIN", "N/A", "NA", "0"]);

export function normalizeBarcode(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  const comparable = trimmed.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").toUpperCase();
  return missingCodes.has(comparable) ? NO_BARCODE : trimmed;
}

export function hasRealBarcode(value: string | null | undefined): boolean {
  const normalized = normalizeBarcode(value);
  return Boolean(normalized && normalized !== NO_BARCODE);
}