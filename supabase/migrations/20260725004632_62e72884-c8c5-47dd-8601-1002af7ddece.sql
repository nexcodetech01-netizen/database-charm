CREATE OR REPLACE FUNCTION public.cancel_sale(_sale_id uuid, _reason text DEFAULT NULL::text)
RETURNS public.sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_sale public.sales%ROWTYPE;
  updated_sale public.sales%ROWTYPE;
BEGIN
  SELECT * INTO current_sale FROM public.sales WHERE id = _sale_id FOR UPDATE;

  IF current_sale.id IS NULL THEN
    RAISE EXCEPTION 'Venda não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.user_has_company_access(current_sale.company_id) THEN
    RAISE EXCEPTION 'Você não tem permissão para cancelar esta venda.' USING ERRCODE = '42501';
  END IF;

  IF current_sale.status = 'cancelled' THEN
    RAISE EXCEPTION 'Esta venda já está cancelada.' USING ERRCODE = 'check_violation';
  END IF;

  IF current_sale.status NOT IN ('draft', 'pending', 'partially_paid', 'paid') THEN
    RAISE EXCEPTION 'Apenas vendas em rascunho, pendentes, parcialmente pagas ou pagas podem ser canceladas.'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.sales
     SET status = 'cancelled',
         notes = CASE
           WHEN NULLIF(BTRIM(COALESCE(_reason, '')), '') IS NULL THEN notes
           WHEN NULLIF(BTRIM(COALESCE(notes, '')), '') IS NULL THEN 'Cancelamento: ' || BTRIM(_reason)
           ELSE notes || E'\nCancelamento: ' || BTRIM(_reason)
         END,
         updated_at = now()
   WHERE id = _sale_id
   RETURNING * INTO updated_sale;

  INSERT INTO public.sale_events(sale_id, company_id, user_id, event_type, reason, payload)
  VALUES (
    updated_sale.id,
    updated_sale.company_id,
    auth.uid(),
    'cancelled',
    NULLIF(BTRIM(COALESCE(_reason, '')), ''),
    jsonb_build_object('previous_status', current_sale.status, 'new_status', 'cancelled')
  );

  RETURN updated_sale;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_credit_account_on_sale_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_account_id uuid;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    UPDATE public.credit_accounts
       SET status = 'cancelled',
           cancelled_at = now(),
           updated_at = now()
     WHERE sale_id = NEW.id
       AND status <> 'cancelled'
     RETURNING id INTO v_account_id;

    IF v_account_id IS NOT NULL THEN
      UPDATE public.credit_installments
         SET status = 'cancelled',
             updated_at = now()
       WHERE credit_account_id = v_account_id
         AND status <> 'cancelled';

      INSERT INTO public.sale_events(sale_id, company_id, user_id, event_type, reason, payload)
      VALUES (
        NEW.id,
        NEW.company_id,
        auth.uid(),
        'credit_cancelled',
        'Crediário cancelado junto com a venda',
        jsonb_build_object('credit_account_id', v_account_id, 'previous_sale_status', OLD.status)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_sale_finance_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  reversed_total numeric := 0;
  payment_methods text[];
  cash_method boolean := false;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    WITH affected AS (
      UPDATE public.financial_transactions ft
         SET status = 'refunded',
             updated_at = now()
       WHERE ft.company_id = NEW.company_id
         AND ft.status = 'paid'
         AND (
           ft.id = NEW.finance_ref
           OR (ft.source = 'sale' AND ft.reference_id = NEW.id)
           OR (
             ft.source = 'credit_payment'
             AND EXISTS (
               SELECT 1
                 FROM public.credit_payments cp
                 JOIN public.credit_accounts ca ON ca.id = cp.credit_account_id
                WHERE cp.id = ft.reference_id
                  AND ca.sale_id = NEW.id
             )
           )
         )
      RETURNING amount, source, reference_id
    )
    SELECT COALESCE(SUM(ABS(a.amount)), 0),
           ARRAY_REMOVE(ARRAY_AGG(cp.payment_method), NULL)
      INTO reversed_total, payment_methods
      FROM affected a
      LEFT JOIN public.credit_payments cp
        ON a.source = 'credit_payment'
       AND cp.id = a.reference_id;

    cash_method := NEW.payment_method = 'cash'
      OR COALESCE(payment_methods && ARRAY['cash']::text[], false);

    IF cash_method AND reversed_total > 0 AND NEW.cash_session_id IS NOT NULL THEN
      INSERT INTO public.cash_movements(
        session_id, company_id, type, amount, reason, reference_id, created_by
      )
      SELECT NEW.cash_session_id,
             NEW.company_id,
             'cash_out',
             reversed_total,
             'sale_cancellation',
             NEW.id,
             auth.uid()
      WHERE NOT EXISTS (
        SELECT 1
          FROM public.cash_movements cm
         WHERE cm.company_id = NEW.company_id
           AND cm.reference_id = NEW.id
           AND cm.type = 'cash_out'
           AND cm.reason = 'sale_cancellation'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid, text) TO service_role;