DROP POLICY IF EXISTS "Users can view their own ML integration" ON public.mercadolivre_integrations;
CREATE POLICY "Users can view their own ML integration"
  ON public.mercadolivre_integrations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = connected_by);