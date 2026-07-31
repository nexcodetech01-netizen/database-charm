-- Payment method fees per company + optional installments on sales

CREATE TABLE IF NOT EXISTS public.payment_method_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  method_key TEXT NOT NULL,
  label TEXT NOT NULL,
  installments INTEGER NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  fee_percent NUMERIC(6,3) NOT NULL DEFAULT 0,
  fee_fixed NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payment_method_fees_unique_key UNIQUE (company_id, method_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_method_fees TO authenticated;
GRANT ALL ON public.payment_method_fees TO service_role;

ALTER TABLE public.payment_method_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_members_manage_payment_fees"
  ON public.payment_method_fees
  FOR ALL
  TO authenticated
  USING (public.user_owns_company(company_id))
  WITH CHECK (public.user_owns_company(company_id));

CREATE TRIGGER trg_payment_method_fees_updated_at
  BEFORE UPDATE ON public.payment_method_fees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_payment_method_fees_company ON public.payment_method_fees(company_id);

-- Seed defaults for every existing company (idempotent)
INSERT INTO public.payment_method_fees (company_id, method_key, label, installments, active, fee_percent, fee_fixed, sort_order)
SELECT c.id, v.method_key, v.label, v.installments, true, v.fee_percent, v.fee_fixed, v.sort_order
FROM public.companies c
CROSS JOIN (VALUES
  ('pix',          'PIX',                       NULL::int, 0.000, 1.99, 10),
  ('cash',         'Dinheiro',                  NULL::int, 0.000, 0.00, 20),
  ('debit_card',   'Cartão de Débito',          NULL::int, 1.890, 0.35, 30),
  ('credit_card_1','Cartão de Crédito à vista', 1,         2.990, 0.49, 40),
  ('credit_card_2','Cartão de Crédito 2x',      2,         3.490, 0.49, 50),
  ('credit_card_3','Cartão de Crédito 3x',      3,         3.490, 0.49, 60)
) AS v(method_key, label, installments, fee_percent, fee_fixed, sort_order)
ON CONFLICT (company_id, method_key) DO NOTHING;

-- Auto-seed defaults when a new company is created
CREATE OR REPLACE FUNCTION public.seed_payment_method_fees()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.payment_method_fees (company_id, method_key, label, installments, active, fee_percent, fee_fixed, sort_order)
  VALUES
    (NEW.id, 'pix',          'PIX',                       NULL, true, 0.000, 1.99, 10),
    (NEW.id, 'cash',         'Dinheiro',                  NULL, true, 0.000, 0.00, 20),
    (NEW.id, 'debit_card',   'Cartão de Débito',          NULL, true, 1.890, 0.35, 30),
    (NEW.id, 'credit_card_1','Cartão de Crédito à vista', 1,    true, 2.990, 0.49, 40),
    (NEW.id, 'credit_card_2','Cartão de Crédito 2x',      2,    true, 3.490, 0.49, 50),
    (NEW.id, 'credit_card_3','Cartão de Crédito 3x',      3,    true, 3.490, 0.49, 60)
  ON CONFLICT (company_id, method_key) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_payment_method_fees ON public.companies;
CREATE TRIGGER trg_seed_payment_method_fees
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.seed_payment_method_fees();

-- Persist installment count on sales so historical fees can be computed
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS installments INTEGER NULL;