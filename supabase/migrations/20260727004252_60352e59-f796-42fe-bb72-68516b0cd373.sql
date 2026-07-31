
-- =====================================================================
-- SANEAMENTO DE DADOS FINANCEIROS LEGADOS  (tag: SANEAMENTO-FIN-20260727)
-- Somente dados. Nenhuma função, trigger, RPC ou regra é alterada.
-- Idempotente: toda etapa é filtrada e marcada pela tag de auditoria.
-- =====================================================================
DO $$
DECLARE
  v_tag text := '[SANEAMENTO-FIN-20260727]';
  n_a int := 0; n_c int := 0; n_f int := 0; n_b int := 0;
BEGIN
  -- 1) Títulos 'refunded' com metadados residuais de liquidação
  WITH upd AS (
    UPDATE public.financial_transactions ft
       SET paid_at = NULL,
           account_id = NULL,
           payment_method = NULL,
           settlement_session_id = NULL,
           notes = btrim(COALESCE(ft.notes || E'\n', '') || v_tag ||
                   format(' metadados de liquidação removidos de título estornado | paid_at anterior: %s | forma: %s | conta: %s',
                          COALESCE(to_char(ft.paid_at, 'YYYY-MM-DD HH24:MI'), '—'),
                          COALESCE(ft.payment_method, '—'),
                          COALESCE(ft.account_id::text, '—'))),
           updated_at = now()
     WHERE ft.status = 'refunded'
       AND (ft.paid_at IS NOT NULL OR ft.account_id IS NOT NULL
            OR ft.payment_method IS NOT NULL OR ft.settlement_session_id IS NOT NULL)
    RETURNING 1)
  SELECT count(*) INTO n_a FROM upd;

  -- 2) Títulos de vendas canceladas ainda em 'cancelled' -> estado terminal único 'refunded'
  WITH upd AS (
    UPDATE public.financial_transactions ft
       SET status = 'refunded',
           paid_at = NULL,
           account_id = NULL,
           payment_method = NULL,
           settlement_session_id = NULL,
           notes = btrim(COALESCE(ft.notes || E'\n', '') || v_tag ||
                   ' status normalizado de cancelled para refunded (venda cancelada)'),
           updated_at = now()
     WHERE ft.status = 'cancelled'
       AND EXISTS (
         SELECT 1 FROM public.sales s
          WHERE s.status = 'cancelled'
            AND (s.finance_ref = ft.id OR (ft.source = 'sale' AND ft.reference_id = s.id)))
    RETURNING 1)
  SELECT count(*) INTO n_c FROM upd;

  -- 3) Títulos de venda sem venda correspondente: apenas auditoria (sem alterar status/valor)
  WITH upd AS (
    UPDATE public.financial_transactions ft
       SET notes = btrim(COALESCE(ft.notes || E'\n', '') || v_tag ||
                   ' título órfão: venda de origem não existe mais — mantido para preservar histórico contábil'),
           updated_at = now()
     WHERE ft.source = 'sale'
       AND (ft.reference_id IS NULL
            OR NOT EXISTS (SELECT 1 FROM public.sales s WHERE s.id = ft.reference_id))
       AND COALESCE(ft.notes, '') NOT LIKE '%' || v_tag || ' título órfão%'
    RETURNING 1)
  SELECT count(*) INTO n_f FROM upd;

  -- 4) Saldos divergentes: current_balance = initial_balance + soma das liquidações efetivas
  WITH calc AS (
    SELECT a.id,
           a.current_balance,
           a.initial_balance + COALESCE((
             SELECT SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END)
               FROM public.financial_transactions t
              WHERE t.account_id = a.id AND t.status = 'paid'), 0) AS expected
      FROM public.financial_accounts a
  ), upd AS (
    UPDATE public.financial_accounts a
       SET current_balance = c.expected,
           updated_at = now()
      FROM calc c
     WHERE a.id = c.id
       AND abs(COALESCE(a.current_balance, 0) - c.expected) > 0.005
    RETURNING 1)
  SELECT count(*) INTO n_b FROM upd;

  RAISE NOTICE '% refunded_metadados=% cancelled_to_refunded=% orfaos_auditados=% saldos_recalculados=%',
    v_tag, n_a, n_c, n_f, n_b;
END $$;
