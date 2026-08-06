CREATE TABLE public.mercadolivre_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    free_shipping_threshold numeric(10,2) DEFAULT 79.00 NOT NULL,
    free_shipping_value numeric(10,2) DEFAULT 24.65 NOT NULL,
    fixed_fee_value numeric(10,2) DEFAULT 6.50 NOT NULL,
    classic_fee_percent numeric(5,4) DEFAULT 0.1350 NOT NULL,
    premium_fee_percent numeric(5,4) DEFAULT 0.1500 NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(company_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mercadolivre_settings TO authenticated;
GRANT ALL ON public.mercadolivre_settings TO service_role;

ALTER TABLE public.mercadolivre_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their company ML settings"
ON public.mercadolivre_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND current_company_id = mercadolivre_settings.company_id
  )
);
