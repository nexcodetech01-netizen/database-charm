ALTER TABLE public.financial_transactions
  DROP CONSTRAINT IF EXISTS financial_transactions_status_check;

ALTER TABLE public.financial_transactions
  ADD CONSTRAINT financial_transactions_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'pending'::text,
        'paid'::text,
        'overdue'::text,
        'cancelled'::text,
        'refunded'::text
      ]
    )
  );