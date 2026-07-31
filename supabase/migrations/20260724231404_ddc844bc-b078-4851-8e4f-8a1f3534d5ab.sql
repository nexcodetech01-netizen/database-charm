
CREATE TABLE public.sku_rename_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  old_sku text NOT NULL,
  new_sku text NOT NULL,
  applied_by uuid REFERENCES auth.users(id),
  source text NOT NULL DEFAULT 'single',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sku_rename_audit_company_idx ON public.sku_rename_audit(company_id, created_at DESC);
CREATE INDEX sku_rename_audit_product_idx ON public.sku_rename_audit(product_id);

GRANT SELECT, INSERT ON public.sku_rename_audit TO authenticated;
GRANT ALL ON public.sku_rename_audit TO service_role;

ALTER TABLE public.sku_rename_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view sku rename audit"
  ON public.sku_rename_audit
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
      UNION
      SELECT id FROM public.companies WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert sku rename audit"
  ON public.sku_rename_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (
    applied_by = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid()
          AND ur.company_id = sku_rename_audit.company_id
          AND r.name IN ('owner','admin')
      )
    )
  );
