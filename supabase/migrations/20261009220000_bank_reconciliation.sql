-- =====================================================================
-- Conciliação do extrato bancário (09/10/2026)
--
-- bank_statement_lines: cada linha do extrato já conferida, para o sistema
-- lembrar na próxima importação (bateu / lançada agora / ignorada).
-- bank_reconciliation_marks: até que dia cada conta foi conferida e com
-- qual saldo do banco.
-- Nenhum saldo é alterado aqui: lançamentos continuam passando pelas
-- funções de baixa e transferência de sempre.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.bank_statement_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_id      uuid NOT NULL REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
  line_hash       text NOT NULL,
  entry_date      date NOT NULL,
  direction       text NOT NULL CHECK (direction IN ('in', 'out')),
  amount          numeric(14,2) NOT NULL CHECK (amount > 0),
  description     text,
  counterparty    text,
  status          text NOT NULL CHECK (status IN ('matched', 'created', 'ignored')),
  transaction_id  uuid REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  transfer_id     uuid REFERENCES public.financial_transfers(id) ON DELETE SET NULL,
  created_by      uuid DEFAULT auth.uid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, line_hash)
);

CREATE INDEX IF NOT EXISTS idx_bank_lines_account_date ON public.bank_statement_lines (account_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_bank_lines_tx ON public.bank_statement_lines (transaction_id);

ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bank_statement_lines FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_statement_lines TO authenticated;
GRANT ALL ON public.bank_statement_lines TO service_role;

DROP POLICY IF EXISTS bank_statement_lines_company ON public.bank_statement_lines;
CREATE POLICY bank_statement_lines_company ON public.bank_statement_lines
  FOR ALL TO authenticated
  USING (public.user_has_company_access(company_id))
  WITH CHECK (public.user_has_company_access(company_id));

CREATE TABLE IF NOT EXISTS public.bank_reconciliation_marks (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_id         uuid NOT NULL REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
  reconciled_until   date NOT NULL,
  statement_balance  numeric(14,2),
  system_balance     numeric(14,2),
  created_by         uuid DEFAULT auth.uid(),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_marks_account ON public.bank_reconciliation_marks (account_id, reconciled_until DESC);

ALTER TABLE public.bank_reconciliation_marks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bank_reconciliation_marks FROM anon;
GRANT SELECT, INSERT ON public.bank_reconciliation_marks TO authenticated;
GRANT ALL ON public.bank_reconciliation_marks TO service_role;

DROP POLICY IF EXISTS bank_reconciliation_marks_select ON public.bank_reconciliation_marks;
CREATE POLICY bank_reconciliation_marks_select ON public.bank_reconciliation_marks
  FOR SELECT TO authenticated
  USING (public.user_has_company_access(company_id));

DROP POLICY IF EXISTS bank_reconciliation_marks_insert ON public.bank_reconciliation_marks;
CREATE POLICY bank_reconciliation_marks_insert ON public.bank_reconciliation_marks
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_company_access(company_id));

-- Histórico de alterações também nas linhas conferidas
DO $$
BEGIN
  IF to_regprocedure('public.audit_row_change()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS zz_audit_row_change ON public.bank_statement_lines;
    CREATE TRIGGER zz_audit_row_change AFTER INSERT OR UPDATE OR DELETE ON public.bank_statement_lines
      FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
  END IF;
END;
$$;
