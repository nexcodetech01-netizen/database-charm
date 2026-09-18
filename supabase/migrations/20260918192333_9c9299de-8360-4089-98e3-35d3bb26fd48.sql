CREATE TABLE public.pending_cash_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('sale', 'purchase')),
  reference_id uuid NOT NULL,
  reference_number text,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  movement_type text NOT NULL CHECK (movement_type IN ('cash_in', 'cash_out')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_session_id uuid REFERENCES public.cash_sessions(id) ON DELETE SET NULL,
  CONSTRAINT pending_cash_reconciliations_resolution_consistent CHECK (
    (resolved_at IS NULL AND resolved_session_id IS NULL)
    OR (resolved_at IS NOT NULL AND resolved_session_id IS NOT NULL)
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_cash_reconciliations TO authenticated;
GRANT ALL ON public.pending_cash_reconciliations TO service_role;

ALTER TABLE public.pending_cash_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pending_cash_reconciliations_company_members"
  ON public.pending_cash_reconciliations
  FOR ALL
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

CREATE INDEX pending_cash_reconciliations_company_pending_idx
  ON public.pending_cash_reconciliations (company_id, created_at)
  WHERE resolved_at IS NULL;

CREATE OR REPLACE FUNCTION public.resolve_pending_cash_reconciliation(_reconciliation_id uuid)
RETURNS public.pending_cash_reconciliations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pending public.pending_cash_reconciliations%ROWTYPE;
  v_session public.cash_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_pending
  FROM public.pending_cash_reconciliations
  WHERE id = _reconciliation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pendência de caixa não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.user_has_company_access(v_pending.company_id) THEN
    RAISE EXCEPTION 'Sem permissão para resolver esta pendência.' USING ERRCODE = '42501';
  END IF;

  IF v_pending.resolved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Esta pendência já foi registrada no caixa.';
  END IF;

  SELECT * INTO v_session
  FROM public.cash_sessions
  WHERE company_id = v_pending.company_id
    AND status = 'open'
  ORDER BY opened_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Abra o caixa pra poder registrar essas devoluções.';
  END IF;

  INSERT INTO public.cash_movements (
    session_id, company_id, type, amount, reason, note, created_by
  ) VALUES (
    v_session.id,
    v_pending.company_id,
    v_pending.movement_type,
    v_pending.amount,
    COALESCE(NULLIF(btrim(v_pending.reason), ''),
      CASE v_pending.source
        WHEN 'sale' THEN 'sale_cancellation'
        ELSE 'purchase_cancellation'
      END),
    format(
      'Reconciliação pendente %s %s',
      CASE v_pending.source WHEN 'sale' THEN 'da venda' ELSE 'da compra' END,
      COALESCE(v_pending.reference_number, v_pending.reference_id::text)
    ),
    auth.uid()
  );

  UPDATE public.pending_cash_reconciliations
  SET resolved_at = now(),
      resolved_session_id = v_session.id
  WHERE id = v_pending.id
  RETURNING * INTO v_pending;

  RETURN v_pending;
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_pending_cash_reconciliation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_pending_cash_reconciliation(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reverse_sale_finance(_sale_id uuid, _reason text DEFAULT NULL::text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sale        public.sales%ROWTYPE;
  v_tx          public.financial_transactions%ROWTYPE;
  v_account     public.financial_accounts%ROWTYPE;
  v_session_id  uuid;
  v_amount      numeric;
  v_audit       text;
  v_note        text;
  v_count       integer := 0;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = _sale_id;
  IF v_sale.id IS NULL THEN
    RAISE EXCEPTION 'Venda não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  SELECT cs.id INTO v_session_id
  FROM public.cash_sessions cs
  WHERE cs.id = v_sale.cash_session_id AND cs.status = 'open';

  IF v_session_id IS NULL THEN
    SELECT cs.id INTO v_session_id
    FROM public.cash_sessions cs
    WHERE cs.company_id = v_sale.company_id AND cs.status = 'open'
    ORDER BY cs.opened_at DESC
    LIMIT 1;
  END IF;

  FOR v_tx IN
    SELECT ft.*
    FROM public.financial_transactions ft
    WHERE ft.company_id = v_sale.company_id
      AND ft.status IN ('paid', 'pending', 'overdue')
      AND (
        ft.id = v_sale.finance_ref
        OR (ft.source = 'sale' AND ft.reference_id = v_sale.id)
        OR (ft.source = 'credit_payment' AND EXISTS (
              SELECT 1
              FROM public.credit_payments cp
              JOIN public.credit_accounts ca ON ca.id = cp.credit_account_id
              WHERE cp.id = ft.reference_id AND ca.sale_id = v_sale.id))
      )
    FOR UPDATE
  LOOP
    v_amount := COALESCE(v_tx.amount, 0);
    v_account := NULL;
    IF v_tx.account_id IS NOT NULL THEN
      SELECT * INTO v_account FROM public.financial_accounts WHERE id = v_tx.account_id;
    END IF;

    IF v_tx.status = 'paid' THEN
      IF v_account.id IS NOT NULL AND v_account.type = 'cash' AND v_amount > 0 THEN
        v_note := 'sale_id=' || v_sale.id::text || ' tx=' || v_tx.id::text;
        IF v_session_id IS NOT NULL THEN
          INSERT INTO public.cash_movements (session_id, company_id, type, amount, reason, note, created_by, transaction_id)
          SELECT v_session_id, v_tx.company_id,
                 CASE WHEN v_tx.type = 'income' THEN 'cash_out' ELSE 'cash_in' END,
                 v_amount, 'sale_cancellation', v_note, auth.uid(), v_tx.id
          WHERE NOT EXISTS (
            SELECT 1 FROM public.cash_movements cm
            WHERE cm.company_id = v_tx.company_id
              AND cm.reason = 'sale_cancellation'
              AND cm.note = v_note
          )
          ON CONFLICT (transaction_id, type) WHERE transaction_id IS NOT NULL DO NOTHING;
        ELSE
          INSERT INTO public.pending_cash_reconciliations (
            company_id, source, reference_id, reference_number,
            amount, movement_type, reason
          ) VALUES (
            v_tx.company_id, 'sale', v_sale.id, v_sale.number,
            v_amount,
            CASE WHEN v_tx.type = 'income' THEN 'cash_out' ELSE 'cash_in' END,
            COALESCE(NULLIF(btrim(_reason), ''), 'Cancelamento de venda')
          );
        END IF;
      END IF;

      IF v_account.id IS NOT NULL THEN
        UPDATE public.financial_accounts
        SET current_balance = COALESCE(current_balance, 0)
              - CASE WHEN v_tx.type = 'income' THEN v_amount ELSE -v_amount END,
            updated_at = now()
        WHERE id = v_account.id;
      END IF;
    END IF;

    v_audit := format(
      '[cancelamento de venda %s] estado anterior: %s | baixa original: %s | forma: %s | conta: %s | valor: %s',
      to_char(now(), 'YYYY-MM-DD HH24:MI'), v_tx.status,
      COALESCE(to_char(v_tx.paid_at, 'YYYY-MM-DD HH24:MI'), '—'),
      COALESCE(v_tx.payment_method, '—'), COALESCE(v_account.name, '—'),
      to_char(v_amount, 'FM999999990.00')
    );
    IF v_tx.status = 'paid' AND (v_account.id IS NULL OR v_account.type <> 'cash') THEN
      NULL;
    ELSIF v_tx.status = 'paid' AND v_session_id IS NULL THEN
      v_audit := v_audit || ' | sem sessão de caixa aberta: movimento de caixa não gerado';
    END IF;
    IF NULLIF(btrim(COALESCE(_reason, '')), '') IS NOT NULL THEN
      v_audit := v_audit || ' | motivo: ' || btrim(_reason);
    END IF;

    UPDATE public.financial_transactions
    SET status = 'refunded', paid_at = NULL, account_id = NULL,
        payment_method = NULL, settlement_session_id = NULL,
        notes = btrim(COALESCE(notes || E'\n', '') || v_audit), updated_at = now()
    WHERE id = v_tx.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reverse_purchase_finance(_purchase_id uuid, _reason text DEFAULT NULL::text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_purchase    public.purchases%ROWTYPE;
  v_tx          public.financial_transactions%ROWTYPE;
  v_account     public.financial_accounts%ROWTYPE;
  v_session_id  uuid;
  v_amount      numeric;
  v_audit       text;
  v_note        text;
  v_count       integer := 0;
BEGIN
  SELECT * INTO v_purchase FROM public.purchases WHERE id = _purchase_id;
  IF v_purchase.id IS NULL THEN
    RAISE EXCEPTION 'Compra não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  SELECT cs.id INTO v_session_id
  FROM public.cash_sessions cs
  WHERE cs.company_id = v_purchase.company_id AND cs.status = 'open'
  ORDER BY cs.opened_at DESC
  LIMIT 1;

  FOR v_tx IN
    SELECT ft.*
    FROM public.financial_transactions ft
    WHERE ft.company_id = v_purchase.company_id
      AND ft.status IN ('paid', 'pending', 'overdue')
      AND ft.source = 'purchase'
      AND ft.reference_id = v_purchase.id
    FOR UPDATE
  LOOP
    v_amount := COALESCE(v_tx.amount, 0);
    v_account := NULL;
    IF v_tx.account_id IS NOT NULL THEN
      SELECT * INTO v_account FROM public.financial_accounts WHERE id = v_tx.account_id;
    END IF;

    IF v_tx.status = 'paid' THEN
      IF v_account.id IS NOT NULL AND v_account.type = 'cash' AND v_amount > 0 THEN
        v_note := 'purchase_id=' || v_purchase.id::text || ' tx=' || v_tx.id::text;
        IF v_session_id IS NOT NULL THEN
          INSERT INTO public.cash_movements (session_id, company_id, type, amount, reason, note, created_by, transaction_id)
          SELECT v_session_id, v_tx.company_id,
                 CASE WHEN v_tx.type = 'income' THEN 'cash_out' ELSE 'cash_in' END,
                 v_amount, 'purchase_cancellation', v_note, auth.uid(), v_tx.id
          WHERE NOT EXISTS (
            SELECT 1 FROM public.cash_movements cm
            WHERE cm.company_id = v_tx.company_id
              AND cm.reason = 'purchase_cancellation'
              AND cm.note = v_note
          )
          ON CONFLICT (transaction_id, type) WHERE transaction_id IS NOT NULL DO NOTHING;
        ELSE
          INSERT INTO public.pending_cash_reconciliations (
            company_id, source, reference_id, reference_number,
            amount, movement_type, reason
          ) VALUES (
            v_tx.company_id, 'purchase', v_purchase.id, v_purchase.number,
            v_amount,
            CASE WHEN v_tx.type = 'income' THEN 'cash_out' ELSE 'cash_in' END,
            COALESCE(NULLIF(btrim(_reason), ''), 'Cancelamento de compra')
          );
        END IF;
      END IF;

      IF v_account.id IS NOT NULL THEN
        UPDATE public.financial_accounts
        SET current_balance = COALESCE(current_balance, 0)
              - CASE WHEN v_tx.type = 'income' THEN v_amount ELSE -v_amount END,
            updated_at = now()
        WHERE id = v_account.id;
      END IF;
    END IF;

    v_audit := format(
      '[cancelamento de compra %s] estado anterior: %s | baixa original: %s | forma: %s | conta: %s | valor: %s',
      to_char(now(), 'YYYY-MM-DD HH24:MI'), v_tx.status,
      COALESCE(to_char(v_tx.paid_at, 'YYYY-MM-DD HH24:MI'), '—'),
      COALESCE(v_tx.payment_method, '—'), COALESCE(v_account.name, '—'),
      to_char(v_amount, 'FM999999990.00')
    );
    IF v_tx.status = 'paid' AND v_account.id IS NOT NULL AND v_account.type = 'cash' AND v_session_id IS NULL THEN
      v_audit := v_audit || ' | sem sessão de caixa aberta: movimento de caixa não gerado';
    END IF;
    IF NULLIF(btrim(COALESCE(_reason, '')), '') IS NOT NULL THEN
      v_audit := v_audit || ' | motivo: ' || btrim(_reason);
    END IF;

    UPDATE public.financial_transactions
    SET status = 'refunded', paid_at = NULL, account_id = NULL,
        payment_method = NULL, settlement_session_id = NULL,
        notes = btrim(COALESCE(notes || E'\n', '') || v_audit), updated_at = now()
    WHERE id = v_tx.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.reverse_sale_finance(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_sale_finance(uuid, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.reverse_purchase_finance(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_purchase_finance(uuid, text) TO authenticated, service_role;