ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS payment_method text;

ALTER TABLE public.financial_transactions
  DROP CONSTRAINT IF EXISTS financial_transactions_payment_method_check;

ALTER TABLE public.financial_transactions
  ADD CONSTRAINT financial_transactions_payment_method_check
  CHECK (payment_method IS NULL OR payment_method = ANY (ARRAY[
    'cash','pix','debit_card','credit_card','bella_pay','bank_transfer','boleto','other'
  ]));