/**
 * Formatting helpers tuned for the Brazilian locale (pt-BR).
 * Kept framework-agnostic so they can be used in components,
 * services, and server functions alike.
 */
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
// Trava padrão de 2 casas decimais para evitar dízimas ruidosas
// (ex.: 30.003 → "30" / 121.853 → "121,85").
const NUM = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const PCT_DEFAULT = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});
const DATE = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const DATE_TIME = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatCurrency = (value: number) => BRL.format(value);

export const formatNumber = (
  value: number,
  opts?: { digits?: number; minDigits?: number },
) => {
  if (opts?.digits != null || opts?.minDigits != null) {
    return new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: opts.digits ?? 2,
      minimumFractionDigits: opts.minDigits ?? 0,
    }).format(value);
  }
  return NUM.format(value);
};

/**
 * Formata um valor como percentual (o "%" é adicionado pelo componente).
 * Padrão: até 2 casas decimais, sem exigir mínimo — elimina "30,003%",
 * "121,853%" e similares.
 */
export const formatPercent = (
  value: number,
  opts?: { digits?: number; minDigits?: number },
) => {
  if (opts?.digits != null || opts?.minDigits != null) {
    return new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: opts.digits ?? 2,
      minimumFractionDigits: opts.minDigits ?? 0,
    }).format(value);
  }
  return PCT_DEFAULT.format(value);
};

export const formatDate = (value: Date | string) =>
  DATE.format(typeof value === "string" ? new Date(value) : value);
export const formatDateTime = (value: Date | string) =>
  DATE_TIME.format(typeof value === "string" ? new Date(value) : value);

/**
 * Regra padrão de parcelamento do catálogo:
 * - preço ≤ 100 → "1x de R$ X sem juros"
 * - preço  > 100 → "Até 3x de R$ (preço/3) sem juros"
 * Retorna null quando o valor é inválido/zero.
 */
export function getInstallmentPlan(price: number): {
  installments: number;
  installmentValue: number;
  label: string;
} | null {
  if (!Number.isFinite(price) || price <= 0) return null;
  if (price <= 100) {
    return {
      installments: 1,
      installmentValue: price,
      label: `1x de ${formatCurrency(price)} sem juros`,
    };
  }
  const v = Math.round((price / 3) * 100) / 100;
  return {
    installments: 3,
    installmentValue: v,
    label: `Até 3x de ${formatCurrency(v)} sem juros`,
  };
}

/** Legenda fixa das condições de pagamento — usada em tela e no PDF. */
export const PAYMENT_CONDITIONS_LEGEND =
  "Condições de Pagamento: Até R$ 100,00 parcela em 1x sem juros | Acima de R$ 100,00 em até 3x sem juros";

export const formatInstallmentLabel = (price: number): string =>
  getInstallmentPlan(price)?.label ?? "";
