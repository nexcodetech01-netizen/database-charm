ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
ALTER TABLE public.sales ADD CONSTRAINT sales_payment_method_check
  CHECK (payment_method = ANY (ARRAY[
    'pix'::text,
    'cash'::text,
    'credit_card'::text,
    'debit_card'::text,
    'payment_link'::text,
    'card'::text,
    'bella_pay'::text
  ]));