CREATE OR REPLACE FUNCTION public.close_cash_session(
  _session_id uuid,
  _counted_cash numeric,
  _closing_note text DEFAULT NULL
)
RETURNS public.cash_sessions
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_session public.cash_sessions%ROWTYPE;
  v_summary record;
  v_by_method jsonb;
BEGIN
  SELECT cs.*
    INTO v_session
    FROM public.cash_sessions cs
   WHERE cs.id = _session_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão não encontrada.';
  END IF;

  IF v_session.status <> 'open' THEN
    RAISE EXCEPTION 'Sessão já está fechada.';
  END IF;

  UPDATE public.cash_sessions
     SET status = 'closed',
         closed_at = now()
   WHERE id = _session_id
   RETURNING * INTO v_session;

  SELECT
    COALESCE(s.expected_cash, 0)::numeric AS expected_cash,
    COALESCE(s.sales_count, 0)::integer AS sales_count,
    COALESCE(s.sales_total, 0)::numeric AS sales_total,
    COALESCE(s.cash_in, 0)::numeric AS cash_in,
    COALESCE(s.cash_out, 0)::numeric AS cash_out
    INTO v_summary
    FROM public.view_cash_session_summary s
   WHERE s.session_id = _session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não foi possível apurar o resumo da sessão.';
  END IF;

  WITH normalized_sales AS (
    SELECT
      CASE
        WHEN lower(trim(s.payment_method)) IN ('cash', 'dinheiro', 'money', 'especie') THEN 'cash'
        WHEN lower(trim(s.payment_method)) IN ('pix', 'pix_manual', 'pix_gateway', 'pix_qr', 'bella_pay') THEN 'pix'
        WHEN lower(trim(s.payment_method)) IN ('credit_card', 'card', 'card_gateway', 'cartao', 'cartao_credito', 'credito') THEN 'credit_card'
        WHEN lower(trim(s.payment_method)) IN ('debit_card', 'cartao_debito', 'debito') THEN 'debit_card'
        WHEN lower(trim(s.payment_method)) IN ('payment_link', 'link', 'link_pagamento') THEN 'payment_link'
        ELSE 'other'
      END AS method,
      COALESCE(s.grand_total, 0)::numeric AS amount
    FROM public.sales s
    WHERE s.cash_session_id = _session_id
      AND s.status IN ('paid', 'partially_paid')
      AND NOT COALESCE(s.is_test, false)
  ), method_totals AS (
    SELECT
      method,
      count(*)::integer AS count,
      COALESCE(sum(amount), 0)::numeric AS total
    FROM normalized_sales
    GROUP BY method
  )
  SELECT jsonb_build_object(
    'cash', jsonb_build_object(
      'count', COALESCE((SELECT count FROM method_totals WHERE method = 'cash'), 0),
      'total', COALESCE((SELECT total FROM method_totals WHERE method = 'cash'), 0)
    ),
    'pix', jsonb_build_object(
      'count', COALESCE((SELECT count FROM method_totals WHERE method = 'pix'), 0),
      'total', COALESCE((SELECT total FROM method_totals WHERE method = 'pix'), 0)
    ),
    'credit_card', jsonb_build_object(
      'count', COALESCE((SELECT count FROM method_totals WHERE method = 'credit_card'), 0),
      'total', COALESCE((SELECT total FROM method_totals WHERE method = 'credit_card'), 0)
    ),
    'debit_card', jsonb_build_object(
      'count', COALESCE((SELECT count FROM method_totals WHERE method = 'debit_card'), 0),
      'total', COALESCE((SELECT total FROM method_totals WHERE method = 'debit_card'), 0)
    ),
    'payment_link', jsonb_build_object(
      'count', COALESCE((SELECT count FROM method_totals WHERE method = 'payment_link'), 0),
      'total', COALESCE((SELECT total FROM method_totals WHERE method = 'payment_link'), 0)
    ),
    'other', jsonb_build_object(
      'count', COALESCE((SELECT count FROM method_totals WHERE method = 'other'), 0),
      'total', COALESCE((SELECT total FROM method_totals WHERE method = 'other'), 0)
    )
  ) INTO v_by_method;

  UPDATE public.cash_sessions
     SET counted_cash = _counted_cash,
         expected_cash = v_summary.expected_cash,
         difference = _counted_cash - v_summary.expected_cash,
         closing_note = _closing_note,
         sales_count = v_summary.sales_count,
         sales_total = v_summary.sales_total,
         cash_in_total = v_summary.cash_in,
         cash_out_total = v_summary.cash_out,
         by_method = v_by_method
   WHERE id = _session_id
   RETURNING * INTO v_session;

  RETURN v_session;
END;
$$;

REVOKE ALL ON FUNCTION public.close_cash_session(uuid, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.close_cash_session(uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.close_cash_session(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_cash_session(uuid, numeric, text) TO service_role;