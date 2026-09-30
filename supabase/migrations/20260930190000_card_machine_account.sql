-- =====================================================================
-- Conta da maquininha (ex.: InfinitePay).
--
-- companies.card_machine_account_id: débito, crédito e PIX pago na
-- maquininha caem nesta conta (ver src/features/sales/lib/settlement-account.ts).
-- A taxa da operadora (payment_method_fees) é lançada automaticamente como
-- despesa saindo desta conta, para o saldo bater com o app da operadora.
-- =====================================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS card_machine_account_id uuid
  REFERENCES public.financial_accounts(id) ON DELETE SET NULL;
