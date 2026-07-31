
-- =============================================================
-- P1.1 — RPC: sales_status_breakdown (GROUP BY status no banco)
-- =============================================================
CREATE OR REPLACE FUNCTION public.sales_status_breakdown(
  _company_id uuid,
  _from date DEFAULT NULL,
  _to date DEFAULT NULL
)
RETURNS TABLE(status text, count bigint, total numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(NULLIF(LOWER(TRIM(s.status)), ''), 'unknown') AS status,
    COUNT(*)::bigint AS count,
    COALESCE(SUM(s.grand_total), 0)::numeric AS total
  FROM public.sales s
  WHERE s.company_id = _company_id
    AND public.user_has_company_access(_company_id)
    AND (_from IS NULL OR s.sale_date >= _from)
    AND (_to   IS NULL OR s.sale_date <= _to)
  GROUP BY 1
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.sales_status_breakdown(uuid, date, date) TO authenticated;

-- =============================================================
-- P1.2 — CHECK constraints
-- =============================================================

-- financial_transactions
ALTER TABLE public.financial_transactions
  DROP CONSTRAINT IF EXISTS financial_transactions_amount_positive;
ALTER TABLE public.financial_transactions
  ADD CONSTRAINT financial_transactions_amount_positive
  CHECK (amount IS NOT NULL AND amount > 0) NOT VALID;

ALTER TABLE public.financial_transactions
  DROP CONSTRAINT IF EXISTS financial_transactions_description_not_blank;
ALTER TABLE public.financial_transactions
  ADD CONSTRAINT financial_transactions_description_not_blank
  CHECK (description IS NOT NULL AND length(btrim(description)) > 0) NOT VALID;

-- products
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_name_not_blank;
ALTER TABLE public.products
  ADD CONSTRAINT products_name_not_blank
  CHECK (name IS NOT NULL AND length(btrim(name)) > 0) NOT VALID;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_cost_non_negative;
ALTER TABLE public.products
  ADD CONSTRAINT products_cost_non_negative
  CHECK (cost IS NULL OR cost >= 0) NOT VALID;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_price_non_negative;
ALTER TABLE public.products
  ADD CONSTRAINT products_price_non_negative
  CHECK (price IS NULL OR price >= 0) NOT VALID;

-- sales
ALTER TABLE public.sales
  DROP CONSTRAINT IF EXISTS sales_customer_required_when_active;
ALTER TABLE public.sales
  ADD CONSTRAINT sales_customer_required_when_active
  CHECK (
    LOWER(COALESCE(status, '')) IN ('draft', 'cancelled')
    OR customer_id IS NOT NULL
  ) NOT VALID;

ALTER TABLE public.sales
  DROP CONSTRAINT IF EXISTS sales_grand_total_non_negative;
ALTER TABLE public.sales
  ADD CONSTRAINT sales_grand_total_non_negative
  CHECK (grand_total IS NULL OR grand_total >= 0) NOT VALID;

-- purchases
ALTER TABLE public.purchases
  DROP CONSTRAINT IF EXISTS purchases_supplier_required_when_active;
ALTER TABLE public.purchases
  ADD CONSTRAINT purchases_supplier_required_when_active
  CHECK (
    LOWER(COALESCE(status, '')) IN ('draft', 'cancelled')
    OR supplier_id IS NOT NULL
  ) NOT VALID;

ALTER TABLE public.purchases
  DROP CONSTRAINT IF EXISTS purchases_grand_total_non_negative;
ALTER TABLE public.purchases
  ADD CONSTRAINT purchases_grand_total_non_negative
  CHECK (grand_total IS NULL OR grand_total >= 0) NOT VALID;
