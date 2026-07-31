/**
 * Unidades que aceitam quantidades fracionadas (peso, volume, comprimento, área).
 * Para as demais (un, pç, cx, pct, dz…) a quantidade é sempre inteira.
 */
export const FRACTIONAL_UNITS = new Set([
  "kg", "g", "mg", "t",
  "l", "ml",
  "m", "cm", "mm", "km",
  "m2", "m²", "m3", "m³",
]);

export function isFractionalUnit(unit?: string | null): boolean {
  if (!unit) return false;
  return FRACTIONAL_UNITS.has(unit.trim().toLowerCase());
}

/**
 * Converte input de quantidade em número, respeitando a natureza da unidade.
 * Unidades inteiras (un, pç…) descartam parte decimal — evita bugs de spinner
 * que geram 1,01 / 1,02 quando o usuário só quer incrementar peças.
 */
export function parseQuantity(raw: string, fractional: boolean): number {
  if (raw === "" || raw == null) return 0;
  const normalized = raw.replace(",", ".");
  const n = fractional ? Number(normalized) : parseInt(normalized, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}
