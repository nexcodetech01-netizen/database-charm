
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS pix_key text,
  ADD COLUMN IF NOT EXISTS pix_key_type text,
  ADD COLUMN IF NOT EXISTS pix_recipient_name text,
  ADD COLUMN IF NOT EXISTS pix_recipient_city text;

ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
ALTER TABLE public.sales ADD CONSTRAINT sales_payment_method_check
  CHECK (payment_method = ANY (ARRAY['pix'::text, 'pix_manual'::text, 'cash'::text, 'credit_card'::text, 'debit_card'::text, 'payment_link'::text, 'card'::text, 'bella_pay'::text]));
