DROP POLICY IF EXISTS cash_movements_company_members ON public.cash_movements;
DROP POLICY IF EXISTS cash_sessions_company_members ON public.cash_sessions;

CREATE POLICY cash_movements_company_members ON public.cash_movements
  FOR ALL TO authenticated
  USING (public.user_owns_company(company_id))
  WITH CHECK (public.user_owns_company(company_id));

CREATE POLICY cash_sessions_company_members ON public.cash_sessions
  FOR ALL TO authenticated
  USING (public.user_owns_company(company_id))
  WITH CHECK (public.user_owns_company(company_id));