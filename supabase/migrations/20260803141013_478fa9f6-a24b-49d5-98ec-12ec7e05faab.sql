-- Criando a migração de backfill para garantir que produtos antigos tenham o canal "loja_fisica"
UPDATE public.products
SET sales_channels = ARRAY['loja_fisica']::text[]
WHERE sales_channels = '{}'::text[] OR sales_channels IS NULL;
