/**
 * Status comercial derivado da margem — leitura, não cálculo de preço.
 */
export type PricingStatus = "premium" | "healthy" | "attention" | "below";

export interface PricingStatusThresholds {
  minMarginPct: number;
  idealMarginPct: number;
  premiumMarginPct: number;
}

export interface PricingStatusView {
  status: PricingStatus;
  label: string;
}

export function resolvePricingStatus(
  marginPct: number,
  t: PricingStatusThresholds,
): PricingStatusView {
  let status: PricingStatus = "below";
  if (marginPct >= t.premiumMarginPct) status = "premium";
  else if (marginPct >= t.idealMarginPct) status = "healthy";
  else if (marginPct >= t.minMarginPct) status = "attention";

  const label =
    status === "premium"
      ? "Margem premium"
      : status === "healthy"
        ? "Margem saudável"
        : status === "attention"
          ? "Atenção — abaixo do ideal"
          : "Abaixo da política mínima";

  return { status, label };
}
