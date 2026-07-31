ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS channel_pricing_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.products.channel_pricing_settings IS
  'Preferências de precificação por canal (marketplaces). Estrutura: { channels: { [channelId]: { marginPct?: number, fixedCost?: number, strategy?: "policy"|"keep_store_profit" } }, globalStrategy?: "policy"|"keep_store_profit" }';