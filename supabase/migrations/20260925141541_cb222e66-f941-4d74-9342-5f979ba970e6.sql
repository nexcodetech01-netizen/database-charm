CREATE TABLE public.company_card_price_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  card_fee_percent numeric(7,4) NOT NULL DEFAULT 2.88,
  max_installments integer NOT NULL DEFAULT 3,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_card_price_config_company_unique UNIQUE (company_id),
  CONSTRAINT company_card_price_config_fee_range CHECK (card_fee_percent >= 0 AND card_fee_percent < 100),
  CONSTRAINT company_card_price_config_installments_range CHECK (max_installments BETWEEN 1 AND 12)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_card_price_config TO authenticated;
GRANT SELECT ON public.company_card_price_config TO anon;
GRANT ALL ON public.company_card_price_config TO service_role;

ALTER TABLE public.company_card_price_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_card_price_config_select"
ON public.company_card_price_config
FOR SELECT
TO authenticated
USING (public.user_has_company_access(company_id));

CREATE POLICY "company_card_price_config_public_select"
ON public.company_card_price_config
FOR SELECT
TO anon
USING (active = true);

CREATE POLICY "company_card_price_config_insert"
ON public.company_card_price_config
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_has_company_access(company_id)
  AND public.has_permission(auth.uid(), company_id, 'finance.update')
);

CREATE POLICY "company_card_price_config_update"
ON public.company_card_price_config
FOR UPDATE
TO authenticated
USING (
  public.user_has_company_access(company_id)
  AND public.has_permission(auth.uid(), company_id, 'finance.update')
)
WITH CHECK (
  public.user_has_company_access(company_id)
  AND public.has_permission(auth.uid(), company_id, 'finance.update')
);

CREATE POLICY "company_card_price_config_delete"
ON public.company_card_price_config
FOR DELETE
TO authenticated
USING (
  public.user_has_company_access(company_id)
  AND public.has_permission(auth.uid(), company_id, 'finance.delete')
);

CREATE TRIGGER company_card_price_config_touch_updated_at
BEFORE UPDATE ON public.company_card_price_config
FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

INSERT INTO public.company_card_price_config (company_id)
SELECT id FROM public.companies
ON CONFLICT (company_id) DO NOTHING;