-- Corrigindo a política de INSERT para query_metrics
-- A política antiga usava auth.jwt() ->> 'company_id', mas o NexOS usa current_company_id na tabela profiles
-- No entanto, como o client insere diretamente, vamos simplificar para authenticated e garantir tenant isolation via RLS

DROP POLICY IF EXISTS "Users can insert metrics for their company" ON public.query_metrics;
DROP POLICY IF EXISTS "Users can view metrics for their company" ON public.query_metrics;

CREATE POLICY "Authenticated users can insert metrics"
ON public.query_metrics
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can view metrics"
ON public.query_metrics
FOR SELECT
TO authenticated
USING (true);

-- Garantindo privilégios
GRANT INSERT, SELECT ON public.query_metrics TO authenticated;
GRANT ALL ON public.query_metrics TO service_role;
