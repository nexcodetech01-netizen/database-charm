/**
 * PDV-010 + PDV-014 — Taxas, parcelamento e liquidação de cartão.
 *
 * Isolado aqui para permitir alteração futura sem tocar em Checkout,
 * webhook, Bella Pay Service, Financeiro ou Sale Detail.
 */

export const CREDIT_CARD_MAX_INSTALLMENTS = 3 as const;
export const CREDIT_CARD_ALLOWED_INSTALLMENTS = [1, 2, 3] as const;

/**
 * PDV-014 — Prazos de liquidação Asaas (referência comercial padrão).
 * Constantes client-side — nenhuma alteração no banco / webhook.
 */
export const SETTLEMENT_DAYS_PIX = 1 as const;
export const SETTLEMENT_DAYS_CREDIT = 32 as const;

/** Taxa fixa default (Asaas cartão). Configurável via localStorage por empresa. */
export const CREDIT_CARD_DEFAULT_FIXED_FEE = 0.49 as const;

export interface CreditCardFeeConfig {
  /** Quando true, a taxa é REPASSADA ao cliente (soma no valor cobrado). */
  absorb: boolean;
  /** Percentual absoluto (ex: 3.99 = 3,99%). */
  feePercent: number;
  /** Limite superior de parcelas configurável (nunca > CREDIT_CARD_MAX_INSTALLMENTS). */
  maxInstallments: number;
  /** Taxa fixa em BRL (ex: 0.49). Opcional; default 0. */
  fixedFee?: number;
}

export interface CreditCardChargeAmounts {
  /** Valor original da venda (base do produto). */
  originalValue: number;
  /** Valor efetivamente cobrado do cliente (após absorção da taxa, se ativa). */
  chargedValue: number;
  /** Valor de cada parcela. */
  installmentValue: number;
  installmentCount: number;
  /** Diferença absoluta somada por absorção da taxa (visível ao cliente). */
  addedFee: number;
  /** Taxa TOTAL deduzida pela adquirente (percentual + fixa), independentemente de absorção. */
  processorFee: number;
  /** Valor líquido que a loja efetivamente recebe. */
  netValue: number;
  /** Prazo estimado de recebimento (dias). */
  settlementDays: number;
  /** Data prevista de recebimento (YYYY-MM-DD). */
  settlementDate: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function addDaysISO(days: number, from: Date = new Date()): string {
  const d = new Date(from.getTime());
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function clampInstallments(
  requested: number,
  config: Pick<CreditCardFeeConfig, "maxInstallments">,
): number {
  const max = Math.min(
    Math.max(1, Math.floor(config.maxInstallments || 1)),
    CREDIT_CARD_MAX_INSTALLMENTS,
  );
  const n = Math.max(1, Math.floor(requested || 1));
  return Math.min(n, max);
}

/**
 * Calcula os valores finais da cobrança de cartão.
 * - `absorb=false`: cobra exatamente o valor da venda. A taxa da adquirente
 *   é deduzida do que a loja recebe (netValue < chargedValue).
 * - `absorb=true`: acrescenta `feePercent%` + `fixedFee` ao valor da venda.
 *   Nesse caso a loja recebe o valor original da venda.
 */
export function computeCreditCardCharge(
  originalValue: number,
  installments: number,
  config: CreditCardFeeConfig,
): CreditCardChargeAmounts {
  const installmentCount = clampInstallments(installments, config);
  const base = Math.max(0, Number(originalValue) || 0);
  const fixedFee = Math.max(0, Number(config.fixedFee) || 0);
  const percent = Math.max(0, Number(config.feePercent) || 0);

  const feeMultiplier = config.absorb && percent > 0 ? 1 + percent / 100 : 1;
  // Absorve: acresce percentual e fixa ao total cobrado do cliente.
  const chargedValue = round2(
    base * feeMultiplier + (config.absorb ? fixedFee : 0),
  );
  const addedFee = round2(chargedValue - base);

  // Taxa efetiva cobrada pela adquirente sobre o valor final cobrado.
  const processorFee = round2((chargedValue * percent) / 100 + fixedFee);
  const netValue = round2(chargedValue - processorFee);

  const installmentValue = round2(chargedValue / installmentCount);

  return {
    originalValue: round2(base),
    chargedValue,
    installmentValue,
    installmentCount,
    addedFee,
    processorFee,
    netValue,
    settlementDays: SETTLEMENT_DAYS_CREDIT,
    settlementDate: addDaysISO(SETTLEMENT_DAYS_CREDIT),
  };
}

export function formatInstallmentSummary(a: CreditCardChargeAmounts): string {
  if (a.installmentCount <= 1) {
    return `1x de ${formatBRL(a.chargedValue)}`;
  }
  return `${a.installmentCount}x de ${formatBRL(a.installmentValue)}`;
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);
}
