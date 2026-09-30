export type CardPriceConfig = {
  cardFeePercent: number;
  maxInstallments: number;
  active: boolean;
  /** A partir deste total (no cartão) a venda pode ser parcelada. 0 = sempre. */
  minInstallmentAmount?: number;
};

export const DEFAULT_CARD_PRICE_CONFIG: CardPriceConfig = {
  cardFeePercent: 2.88,
  maxInstallments: 3,
  active: true,
  minInstallmentAmount: 0,
};

/**
 * Máximo de parcelas para um total no cartão: abaixo do valor mínimo
 * configurado é 1x (ainda com o preço de cartão). Mesma regra da RPC
 * apply_pdv_payment_pricing — "a partir de" inclui o próprio valor.
 */
export function maxInstallmentsFor(
  cardTotal: number,
  config: Pick<CardPriceConfig, "maxInstallments" | "minInstallmentAmount"> = DEFAULT_CARD_PRICE_CONFIG,
): number {
  const max = Math.max(1, Math.trunc(Number(config.maxInstallments) || 1));
  const min = Number(config.minInstallmentAmount ?? 0);
  const total = Number(cardTotal);
  if (Number.isFinite(min) && min > 0 && !(Number.isFinite(total) && total >= min)) return 1;
  return max;
}

export function calcPrecoCartao(
  precoAvista: number,
  config: CardPriceConfig = DEFAULT_CARD_PRICE_CONFIG,
): number {
  const cash = Number(precoAvista);
  const fee = Number(config.cardFeePercent);
  if (!Number.isFinite(cash) || cash <= 0) return 0;
  const cashCents = Math.round(cash * 100);
  if (!config.active || !Number.isFinite(fee) || fee <= 0 || fee >= 100) return cashCents / 100;
  const feeBasisPoints = Math.round(fee * 100);
  const denominator = 10000 - feeBasisPoints;
  if (denominator <= 0) return cashCents / 100;
  return Math.ceil((cashCents * 10000) / denominator) / 100;
}

export function calcParcela(precoCartao: number, parcelas: number): number {
  const total = Number(precoCartao);
  const count = Math.max(1, Math.trunc(Number(parcelas) || 1));
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.ceil(Math.round(total * 100) / count) / 100;
}

export function calcTotalCartaoPdv(
  items: Array<{ unit_price: number; quantity: number; discount: number }>,
  desconto: number,
  frete: number,
  config: CardPriceConfig = DEFAULT_CARD_PRICE_CONFIG,
): number {
  const subtotal = items.reduce((sum, item) => {
    const quantity = Number(item.quantity);
    const discount = Number(item.discount);
    const lineTotal = calcPrecoCartao(item.unit_price, config)
      * (Number.isFinite(quantity) && quantity > 0 ? quantity : 0)
      - (Number.isFinite(discount) ? discount : 0);
    return sum + Math.max(0, lineTotal);
  }, 0);
  const normalizedDiscount = Number.isFinite(Number(desconto)) ? Number(desconto) : 0;
  const normalizedShipping = Number.isFinite(Number(frete)) ? Number(frete) : 0;
  return Math.max(0, subtotal - normalizedDiscount + normalizedShipping);
}

export function calcTotalAvistaPdv(
  items: Array<{ unit_price: number; quantity: number; discount: number }>,
  desconto: number,
  frete: number,
): number {
  const subtotal = items.reduce((sum, item) => {
    const unitPrice = Number(item.unit_price);
    const quantity = Number(item.quantity);
    const discount = Number(item.discount);
    const lineTotal = (Number.isFinite(unitPrice) ? unitPrice : 0)
      * (Number.isFinite(quantity) && quantity > 0 ? quantity : 0)
      - (Number.isFinite(discount) ? discount : 0);
    return sum + Math.max(0, lineTotal);
  }, 0);
  const normalizedDiscount = Number.isFinite(Number(desconto)) ? Number(desconto) : 0;
  const normalizedShipping = Number.isFinite(Number(frete)) ? Number(frete) : 0;
  return Math.max(0, subtotal - normalizedDiscount + normalizedShipping);
}

export function normalizeCardPriceConfig(
  row?: {
    card_fee_percent?: number | string | null;
        max_installments?: number | string | null;
    active?: boolean | null;
    min_installment_amount?: number | string | null;
  } | null,
): CardPriceConfig {
  return {
    cardFeePercent: Number(row?.card_fee_percent ?? DEFAULT_CARD_PRICE_CONFIG.cardFeePercent),
    maxInstallments: Math.max(
      1,
      Math.trunc(Number(row?.max_installments ?? DEFAULT_CARD_PRICE_CONFIG.maxInstallments)),
    ),
        active: row?.active ?? DEFAULT_CARD_PRICE_CONFIG.active,
    minInstallmentAmount: Math.max(0, Number(row?.min_installment_amount ?? 0) || 0),
  };
}