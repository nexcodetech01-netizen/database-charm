export type CardPriceConfig = {
  cardFeePercent: number;
  maxInstallments: number;
  active: boolean;
};

export const DEFAULT_CARD_PRICE_CONFIG: CardPriceConfig = {
  cardFeePercent: 2.88,
  maxInstallments: 3,
  active: true,
};

const ceilCents = (value: number) => Math.ceil((value - Number.EPSILON) * 100) / 100;

export function calcPrecoCartao(
  precoAvista: number,
  config: CardPriceConfig = DEFAULT_CARD_PRICE_CONFIG,
): number {
  const cash = Number(precoAvista);
  const fee = Number(config.cardFeePercent);
  if (!Number.isFinite(cash) || cash <= 0) return 0;
  if (!config.active || !Number.isFinite(fee) || fee <= 0) return ceilCents(cash);
  if (fee >= 100) return ceilCents(cash);
  return ceilCents(cash / (1 - fee / 100));
}

export function calcParcela(precoCartao: number, parcelas: number): number {
  const total = Number(precoCartao);
  const count = Math.max(1, Math.trunc(Number(parcelas) || 1));
  if (!Number.isFinite(total) || total <= 0) return 0;
  return ceilCents(total / count);
}

export function calcTotalCartaoPdv(
  items: Array<{ unit_price: number; quantity: number }>,
  desconto: number,
  frete: number,
  config: CardPriceConfig = DEFAULT_CARD_PRICE_CONFIG,
): number {
  const subtotal = items.reduce((sum, item) => {
    const quantity = Number(item.quantity);
    return sum + calcPrecoCartao(item.unit_price, config) * (
      Number.isFinite(quantity) && quantity > 0 ? quantity : 0
    );
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
  } | null,
): CardPriceConfig {
  return {
    cardFeePercent: Number(row?.card_fee_percent ?? DEFAULT_CARD_PRICE_CONFIG.cardFeePercent),
    maxInstallments: Math.max(
      1,
      Math.trunc(Number(row?.max_installments ?? DEFAULT_CARD_PRICE_CONFIG.maxInstallments)),
    ),
    active: row?.active ?? DEFAULT_CARD_PRICE_CONFIG.active,
  };
}