ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS payment_confirmed_at timestamptz;

COMMENT ON COLUMN public.sales.payment_confirmed_at IS
  'Instante em que o pagamento foi confirmado pelo servidor (webhook Bella Pay). NULL para vendas pagas manualmente ou em dinheiro.';