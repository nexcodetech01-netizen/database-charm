-- =====================================================================
-- Transferência entre contas (ex.: Caixa → Banco PJ, InfinitePay → Nubank)
--
-- BUG CORRIGIDO (2026-10-01): "Nova Transferência" no Financeiro gravava um
-- lançamento do tipo 'transfer' mas NADA atualizava os saldos — o dinheiro
-- não saía de uma conta nem entrava na outra.
--
-- Agora a transferência fica numa tabela própria e a RPC
-- transfer_between_accounts move os dois saldos na mesma transação. Fica
-- fora de financial_transactions de propósito: transferência não é receita
-- nem despesa (não entra na DRE nem no fechamento do mês).
--
-- Depósito do caixa: se _cash_session_id for informado e a conta de origem
-- for do tipo 'cash', registra também a sangria na gaveta (motivo
-- "Depósito no banco"), para o fechamento do caixa bater.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.financial_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  from_account_id uuid NOT NULL REFERENCES public.financial_accounts(id),
  to_account_id uuid NOT NULL REFERENCES public.financial_accounts(id),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  cash_movement_id uuid REFERENCES public.cash_movements(id) ON DELETE SET NULL,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_account_id <> to_account_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_transfers_company_date
  ON public.financial_transfers(company_id, transfer_date DESC);

ALTER TABLE public.financial_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financial_transfers_select ON public.financial_transfers;
CREATE POLICY financial_transfers_select ON public.financial_transfers
  FOR SELECT TO authenticated
  USING (public.user_has_company_access(company_id));
-- Inserção só pela RPC (SECURITY DEFINER), que também move os saldos.

GRANT SELECT ON public.financial_transfers TO authenticated;
GRANT ALL ON public.financial_transfers TO service_role;

CREATE OR REPLACE FUNCTION public.transfer_between_accounts(
  _company_id uuid,
  _from_account_id uuid,
  _to_account_id uuid,
  _amount numeric,
  _date date DEFAULT CURRENT_DATE,
  _description text DEFAULT NULL,
  _cash_session_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_from public.financial_accounts%ROWTYPE;
  v_to public.financial_accounts%ROWTYPE;
  v_amount numeric := round(coalesce(_amount, 0), 2);
  v_movement uuid;
  v_transfer uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_has_company_access(_company_id) THEN
    RAISE EXCEPTION 'Acesso negado a esta empresa' USING ERRCODE = '42501';
  END IF;
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Informe um valor maior que zero.';
  END IF;
  IF _from_account_id = _to_account_id THEN
    RAISE EXCEPTION 'Escolha contas diferentes para a transferência.';
  END IF;

  -- Trava as duas contas (ordem fixa evita deadlock)
  PERFORM 1 FROM financial_accounts
   WHERE id IN (_from_account_id, _to_account_id)
   ORDER BY id FOR UPDATE;

  SELECT * INTO v_from FROM financial_accounts WHERE id = _from_account_id;
  SELECT * INTO v_to FROM financial_accounts WHERE id = _to_account_id;
  IF v_from.id IS NULL OR v_to.id IS NULL
     OR v_from.company_id <> _company_id OR v_to.company_id <> _company_id THEN
    RAISE EXCEPTION 'Conta não encontrada nesta empresa.';
  END IF;
  IF v_from.status <> 'active' OR v_to.status <> 'active' THEN
    RAISE EXCEPTION 'As duas contas precisam estar ativas.';
  END IF;

  -- Depósito do dinheiro da gaveta: registra a sangria na sessão do caixa
  IF _cash_session_id IS NOT NULL AND v_from.type = 'cash' THEN
    INSERT INTO cash_movements (company_id, session_id, type, amount, reason, note, created_by)
    VALUES (_company_id, _cash_session_id, 'cash_out', v_amount, 'Depósito no banco',
            coalesce(_description, 'Transferência para ' || v_to.name), auth.uid())
    RETURNING id INTO v_movement;
  END IF;

  UPDATE financial_accounts
     SET current_balance = coalesce(current_balance, 0) - v_amount, updated_at = now()
   WHERE id = _from_account_id;
  UPDATE financial_accounts
     SET current_balance = coalesce(current_balance, 0) + v_amount, updated_at = now()
   WHERE id = _to_account_id;

  INSERT INTO financial_transfers (company_id, from_account_id, to_account_id, amount,
                                   transfer_date, description, cash_movement_id, created_by)
  VALUES (_company_id, _from_account_id, _to_account_id, v_amount,
          coalesce(_date, CURRENT_DATE),
          coalesce(nullif(trim(_description), ''), v_from.name || ' → ' || v_to.name),
          v_movement, auth.uid())
  RETURNING id INTO v_transfer;

  RETURN v_transfer;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.transfer_between_accounts(uuid, uuid, uuid, numeric, date, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_between_accounts(uuid, uuid, uuid, numeric, date, text, uuid) TO authenticated;
