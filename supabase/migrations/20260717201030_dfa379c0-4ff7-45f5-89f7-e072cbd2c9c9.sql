
-- Add packaging cost column to products (matches freight/insurance/other_costs pattern)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS packaging NUMERIC NOT NULL DEFAULT 0;

-- Add operational cost defaults per company
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS default_freight NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_packaging NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_insurance NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_other_costs NUMERIC NOT NULL DEFAULT 0;
