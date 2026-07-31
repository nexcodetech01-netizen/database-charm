CREATE OR REPLACE FUNCTION public.cancel_credit_account_on_sale_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    UPDATE public.credit_accounts
       SET status = 'cancelled',
           cancelled_at = COALESCE(cancelled_at, now()),
           updated_at = now()
     WHERE sale_id = NEW.id
       AND status IN ('open','partially_paid');

    UPDATE public.credit_installments ci
       SET status = 'cancelled',
           updated_at = now()
      FROM public.credit_accounts ca
     WHERE ci.credit_account_id = ca.id
       AND ca.sale_id = NEW.id
       AND ci.status IN ('pending','partially_paid');

    INSERT INTO public.sale_events(
      sale_id, company_id, user_id, event_type, reason, payload
    )
    SELECT
      NEW.id,
      NEW.company_id,
      auth.uid(),
      'credit_cancelled',
      'Crediário cancelado junto com a venda',
      jsonb_build_object(
        'previous_status', OLD.status,
        'sale_number', NEW.number
      )
    WHERE EXISTS (
      SELECT 1
        FROM public.credit_accounts
       WHERE sale_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$function$;