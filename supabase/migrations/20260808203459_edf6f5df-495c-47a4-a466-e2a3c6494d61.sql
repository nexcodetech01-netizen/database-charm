ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS pos_default_account_id uuid REFERENCES public.financial_accounts(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.companies.pos_default_account_id IS 'Conta financeira padrão para recebimentos automáticos do PDV (Dinheiro, Débito, PIX Próprio).';
