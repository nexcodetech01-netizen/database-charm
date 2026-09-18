DROP POLICY IF EXISTS "Owners manage financial accounts" ON public.financial_accounts;
DROP POLICY IF EXISTS "Owners manage financial transactions" ON public.financial_transactions;

DROP POLICY IF EXISTS "rbac_financial_accounts_select" ON public.financial_accounts;
DROP POLICY IF EXISTS "rbac_financial_accounts_insert" ON public.financial_accounts;
DROP POLICY IF EXISTS "rbac_financial_accounts_update" ON public.financial_accounts;
DROP POLICY IF EXISTS "rbac_financial_accounts_delete" ON public.financial_accounts;

CREATE POLICY "rbac_financial_accounts_select"
ON public.financial_accounts
FOR SELECT TO authenticated
USING (
  public.user_has_company_access(company_id)
  AND public.has_permission(auth.uid(), company_id, 'finance.view')
);

CREATE POLICY "rbac_financial_accounts_insert"
ON public.financial_accounts
FOR INSERT TO authenticated
WITH CHECK (
  public.user_has_company_access(company_id)
  AND public.has_permission(auth.uid(), company_id, 'finance.create')
);

CREATE POLICY "rbac_financial_accounts_update"
ON public.financial_accounts
FOR UPDATE TO authenticated
USING (
  public.user_has_company_access(company_id)
  AND public.has_permission(auth.uid(), company_id, 'finance.update')
)
WITH CHECK (
  public.user_has_company_access(company_id)
  AND public.has_permission(auth.uid(), company_id, 'finance.update')
);

CREATE POLICY "rbac_financial_accounts_delete"
ON public.financial_accounts
FOR DELETE TO authenticated
USING (
  public.user_has_company_access(company_id)
  AND public.has_permission(auth.uid(), company_id, 'finance.delete')
  AND NOT EXISTS (
    SELECT 1
    FROM public.financial_transactions ft
    WHERE ft.account_id = financial_accounts.id
       OR ft.transfer_to_account_id = financial_accounts.id
  )
);

DROP POLICY IF EXISTS "rbac_financial_transactions_select" ON public.financial_transactions;
DROP POLICY IF EXISTS "rbac_financial_transactions_insert" ON public.financial_transactions;
DROP POLICY IF EXISTS "rbac_financial_transactions_update" ON public.financial_transactions;
DROP POLICY IF EXISTS "rbac_financial_transactions_delete" ON public.financial_transactions;

CREATE POLICY "rbac_financial_transactions_select"
ON public.financial_transactions
FOR SELECT TO authenticated
USING (
  public.user_has_company_access(company_id)
  AND public.has_permission(auth.uid(), company_id, 'finance.view')
);

CREATE POLICY "rbac_financial_transactions_insert"
ON public.financial_transactions
FOR INSERT TO authenticated
WITH CHECK (
  public.user_has_company_access(company_id)
  AND public.has_permission(auth.uid(), company_id, 'finance.create')
);

CREATE POLICY "rbac_financial_transactions_update"
ON public.financial_transactions
FOR UPDATE TO authenticated
USING (
  public.user_has_company_access(company_id)
  AND public.has_permission(auth.uid(), company_id, 'finance.update')
)
WITH CHECK (
  public.user_has_company_access(company_id)
  AND public.has_permission(auth.uid(), company_id, 'finance.update')
);

CREATE POLICY "rbac_financial_transactions_delete"
ON public.financial_transactions
FOR DELETE TO authenticated
USING (
  public.user_has_company_access(company_id)
  AND public.has_permission(auth.uid(), company_id, 'finance.delete')
  AND status = 'pending'
  AND NOT EXISTS (
    SELECT 1
    FROM public.cash_movements cm
    WHERE cm.transaction_id = financial_transactions.id
  )
);