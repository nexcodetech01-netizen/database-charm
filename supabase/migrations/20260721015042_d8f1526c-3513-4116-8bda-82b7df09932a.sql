GRANT SELECT, INSERT, UPDATE, DELETE ON public.mercadolivre_integrations TO authenticated;

DROP POLICY IF EXISTS "Company members manage ML integration" ON public.mercadolivre_integrations;
CREATE POLICY "Company members manage ML integration"
ON public.mercadolivre_integrations
FOR ALL
TO authenticated
USING (public.user_has_company_access(company_id))
WITH CHECK (public.user_has_company_access(company_id));