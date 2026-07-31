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
  v_notes text := 'sale_id=' || NEW.id::text;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    WITH affected AS (
      UPDATE public.financial_transactions ft
         SET status = 'refunded', updated_at = now()
       WHERE ft.company_id = NEW.company_id
         AND ft.status = 'paid'
         AND (
           ft.id = NEW.finance_ref
           OR (ft.source = 'sale' AND ft.reference_id = NEW.id)
           OR (ft.source = 'credit_payment' AND EXISTS (
             SELECT 1 FROM public.credit_payments cp
             JOIN public.credit_accounts ca ON ca.id = cp.credit_account_id
             WHERE cp.id = ft.reference_id AND ca.sale_id = NEW.id
           ))
         )
      RETURNING amount, source, reference_id
    )
    SELECT COALESCE(SUM(ABS(a.amount)),0), ARRAY_REMOVE(ARRAY_AGG(cp.payment_method),NULL)
      INTO reversed_total, payment_methods
      FROM affected a
      LEFT JOIN public.credit_payments cp ON a.source='credit_payment' AND cp.id=a.reference_id;

    cash_method := NEW.payment_method = 'cash' OR COALESCE(payment_methods && ARRAY['cash']::text[], false);

    IF cash_method AND reversed_total > 0 AND NEW.cash_session_id IS NOT NULL THEN
      INSERT INTO public.cash_movements(session_id,company_id,type,amount,reason,notes,created_by)
      SELECT NEW.cash_session_id,NEW.company_id,'cash_out',reversed_total,'sale_cancellation',v_notes,auth.uid()
      WHERE NOT EXISTS (
        SELECT 1 FROM public.cash_movements cm
        WHERE cm.company_id=NEW.company_id
          AND cm.session_id=NEW.cash_session_id
          AND cm.type='cash_out'
          AND cm.reason='sale_cancellation'
          AND cm.notes=v_notes
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;