-- Preserve SELECT/INSERT/UPDATE policies exactly as they are and harden only DELETE.

DROP POLICY IF EXISTS rbac_cash_sessions_delete ON public.cash_sessions;
CREATE POLICY rbac_cash_sessions_delete ON public.cash_sessions
  FOR DELETE TO authenticated
  USING (
    user_has_company_access(company_id)
    AND has_permission(auth.uid(), company_id, 'finance.delete')
    AND status = 'open'
  );

DROP POLICY IF EXISTS rbac_cash_movements_delete ON public.cash_movements;
CREATE POLICY rbac_cash_movements_delete ON public.cash_movements
  FOR DELETE TO authenticated
  USING (
    user_has_company_access(company_id)
    AND has_permission(auth.uid(), company_id, 'finance.delete')
    AND transaction_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.cash_sessions cs
      WHERE cs.id = cash_movements.session_id
        AND cs.company_id = cash_movements.company_id
        AND cs.status = 'open'
    )
  );

DROP POLICY IF EXISTS rbac_credit_accounts_delete ON public.credit_accounts;
CREATE POLICY rbac_credit_accounts_delete ON public.credit_accounts
  FOR DELETE TO authenticated
  USING (
    user_has_company_access(company_id)
    AND has_permission(auth.uid(), company_id, 'finance.delete')
    AND status = 'open'
    AND balance = original_amount
  );

DROP POLICY IF EXISTS rbac_credit_installments_delete ON public.credit_installments;
CREATE POLICY rbac_credit_installments_delete ON public.credit_installments
  FOR DELETE TO authenticated
  USING (
    user_has_company_access(company_id)
    AND has_permission(auth.uid(), company_id, 'finance.delete')
    AND status = 'pending'
  );

DROP POLICY IF EXISTS rbac_credit_payments_delete ON public.credit_payments;

DROP POLICY IF EXISTS rbac_cost_centers_delete ON public.cost_centers;
CREATE POLICY rbac_cost_centers_delete ON public.cost_centers
  FOR DELETE TO authenticated
  USING (
    user_has_company_access(company_id)
    AND has_permission(auth.uid(), company_id, 'finance.delete')
    AND NOT EXISTS (
      SELECT 1
      FROM public.financial_transactions ft
      WHERE ft.cost_center_id = cost_centers.id
    )
  );