-- Vendas do Mercado Livre não baixavam estoque: o webhook e a reconciliação
-- gravam inventory_movements.source = 'mercadolivre', mas a lista permitida
-- (20260730145832) não tinha esse valor, então todo INSERT era recusado.
-- O índice de idempotência uq_inventory_external_reference já previa essas
-- origens. Inclui também 'sale_kit_explosion' (baixa de componentes de kit).
ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_source_check;
ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_source_check
  CHECK (source IS NULL OR source = ANY (ARRAY[
    'manual','purchase','sale','adjustment','sale_return','sale_cancellation',
    'system','opening','sale_kit_explosion',
    'mercadolivre','shopify','webhook','integration'
  ])) NOT VALID;
