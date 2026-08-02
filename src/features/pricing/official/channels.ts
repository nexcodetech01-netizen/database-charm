/**
 * Catálogo canônico de taxas de CANAL (marketplace / loja própria).
 * =================================================================
 * Motor Comercial V2: nenhum componente pode declarar percentual de canal
 * localmente. Quando a empresa não configurou a taxa do canal em
 * `products.channel_pricing_settings`, o valor de referência sai daqui —
 * ponto único, versionado e auditável.
 */
export interface ChannelFeeDefault {
  readonly channelId: string;
  readonly label: string;
  /** Comissão do canal (% sobre o preço de venda). */
  readonly feePct: number;
  /** Tarifa fixa por pedido (R$). */
  readonly fixedFee: number;
}

export const CHANNEL_FEE_DEFAULTS: Readonly<Record<string, ChannelFeeDefault>> = {
  ml: { channelId: "ml", label: "Mercado Livre", feePct: 16, fixedFee: 6 },
  site: { channelId: "site", label: "Loja própria", feePct: 0, fixedFee: 0 },
};

/** Resolve a taxa do canal: configuração da empresa vence o default. */
export function resolveChannelFee(
  channelId: string,
  override?: { feePct?: number | null; fixedCost?: number | null } | null,
): ChannelFeeDefault {
  const base =
    CHANNEL_FEE_DEFAULTS[channelId] ??
    ({ channelId, label: channelId, feePct: 0, fixedFee: 0 } as ChannelFeeDefault);
  const pct = Number(override?.feePct);
  const fixed = Number(override?.fixedCost);
  return {
    ...base,
    feePct: Number.isFinite(pct) && pct >= 0 ? pct : base.feePct,
    fixedFee: Number.isFinite(fixed) && fixed >= 0 ? fixed : base.fixedFee,
  };
}
