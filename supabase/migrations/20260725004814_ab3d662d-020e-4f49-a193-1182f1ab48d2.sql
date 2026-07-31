ALTER TABLE public.financial_transactions
DROP CONSTRAINT IF EXISTS financial_transactions_source_check;

ALTER TABLE public.financial_transactions
ADD CONSTRAINT financial_transactions_source_check
CHECK (source = ANY (ARRAY[
  'manual'::text,
  'sale'::text,
  'purchase'::text,
  'bella_pay'::text,
  'sale_return'::text,
  'sale_cancellation'::text,
  'credit_payment'::text
]));