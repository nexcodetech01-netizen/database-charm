DROP POLICY IF EXISTS "pending_cash_reconciliations_company_members"
  ON public.pending_cash_reconciliations;

DROP POLICY IF EXISTS "pending_cash_reconciliations_select"
  ON public.pending_cash_reconciliations;
DROP POLICY IF EXISTS "pending_cash_reconciliations_insert"
  ON public.pending_cash_reconciliations;
DROP POLICY IF EXISTS "pending_cash_reconciliations_update"
  ON public.pending_cash_reconciliations;
DROP POLICY IF EXISTS "pending_cash_reconciliations_delete"
  ON public.pending_cash_reconciliations;

CREATE POLICY "pending_cash_reconciliations_select"
  ON public.pending_cash_reconciliations
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "pending_cash_reconciliations_insert"
  ON public.pending_cash_reconciliations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "pending_cash_reconciliations_update"
  ON public.pending_cash_reconciliations
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "pending_cash_reconciliations_delete"
  ON public.pending_cash_reconciliations
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
    AND public.has_permission(auth.uid(), company_id, 'finance.delete')
    AND resolved_at IS NOT NULL
  );