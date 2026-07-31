
-- 1) Política Comercial por categoria: acrescenta desconto padrão
ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS default_discount_pct NUMERIC(5,2);

COMMENT ON COLUMN public.product_categories.default_discount_pct IS
  'Desconto padrão (%) aplicado automaticamente no PDV ao adicionar produtos desta categoria. Vendedor pode alterar.';

-- 2) Snapshot imutável da Política Comercial no momento da venda
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS unit_cost                NUMERIC(14,4),
  ADD COLUMN IF NOT EXISTS category_target_margin_pct NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS category_min_margin_pct    NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS category_default_discount_pct NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS applied_discount_pct     NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS profit_snapshot          NUMERIC(14,4),
  ADD COLUMN IF NOT EXISTS final_margin_pct         NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS below_min_margin         BOOLEAN;

COMMENT ON COLUMN public.sale_items.category_target_margin_pct IS
  'Snapshot: margem alvo da categoria no momento da venda. Imutável.';
COMMENT ON COLUMN public.sale_items.category_min_margin_pct IS
  'Snapshot: margem mínima da categoria no momento da venda. Imutável.';
COMMENT ON COLUMN public.sale_items.category_default_discount_pct IS
  'Snapshot: desconto padrão da categoria no momento da venda. Imutável.';
COMMENT ON COLUMN public.sale_items.applied_discount_pct IS
  'Percentual de desconto efetivamente aplicado neste item.';
COMMENT ON COLUMN public.sale_items.profit_snapshot IS
  'Lucro (receita - custo) obtido neste item, computado no momento da venda.';
COMMENT ON COLUMN public.sale_items.final_margin_pct IS
  'Margem final (%) obtida neste item após desconto.';
COMMENT ON COLUMN public.sale_items.below_min_margin IS
  'true se, no momento da venda, a margem final ficou abaixo da margem mínima da categoria.';
