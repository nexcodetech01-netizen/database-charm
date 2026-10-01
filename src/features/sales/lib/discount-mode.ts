/**
 * Desconto em R$ ou em % (PDV: desconto da venda e desconto/acréscimo por item).
 * A venda continua gravando o desconto em reais — o % é só a forma de digitar.
 */

export type DiscountMode = "value" | "percent";

const STORAGE_KEY = "nexos:pdv:discount-mode";

const cents = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

/** % → R$, arredondado nos centavos e limitado à base. */
export function percentToValue(base: number, percent: number): number {
  const b = Math.max(0, Number(base) || 0);
  const p = Math.min(100, Math.max(0, Number(percent) || 0));
  return Math.min(b, cents((b * p) / 100));
}

/** R$ → %, com até 2 casas. */
export function valueToPercent(base: number, value: number): number {
  const b = Number(base) || 0;
  if (b <= 0) return 0;
  return Math.round(((Number(value) || 0) / b) * 10000) / 100;
}

/** Última forma usada (lembrada no navegador). */
export function readDiscountMode(): DiscountMode {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY) === "percent"
      ? "percent"
      : "value";
  } catch {
    return "value";
  }
}

export function writeDiscountMode(mode: DiscountMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* navegador sem storage: só não lembra */
  }
}
