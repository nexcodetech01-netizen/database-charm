CREATE OR REPLACE FUNCTION public.cancel_sale_finance_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_original_ft public.financial_transactions%ROWTYPE;
  v_session_status text;
  v_amount numeric;
BEGIN
  IF NEW.status <> 'cancelled' OR OLD.status IS NOT DISTINCT FROM 'cancelled' THEN
    RETURN NEW;
  END IF;

  UPDATE public.financial_transactions
     SET status = 'cancelled', updated_at = now()
   WHERE source = 'sale'
     AND reference_id = NEW.id
     AND status NOT IN ('paid', 'cancelled', 'refunded');

  IF OLD.status = 'paid' THEN
    SELECT * INTO v_original_ft
      FROM public.financial_transactions
     WHERE source = 'sale'
       AND reference_id = NEW.id
       AND status = 'paid'
     ORDER BY paid_at DESC NULLS LAST, created_at DESC
     LIMIT 1;

    v_amount := COALESCE(v_original_ft.amount, NEW.grand_total, 0);

    IF NOT EXISTS (
      SELECT 1
        FROM public.financial_transactions
       WHERE source = 'sale_cancellation'
         AND reference_id = NEW.id
    ) AND v_amount > 0 THEN
      INSERT INTO public.financial_transactions(
        company_id, type, description, amount,
        transaction_date, due_date, paid_at, status,
        source, reference_id, reference_number,
        account_id, category_id, created_by
      ) VALUES (
        NEW.company_id, 'expense',
        'Estorno de venda ' || COALESCE(NEW.number, NEW.id::text),
        v_amount,
        CURRENT_DATE, CURRENT_DATE, now(), 'paid',
        'sale_cancellation', NEW.id,
        'EST-' || COALESCE(NEW.number, NEW.id::text),
        v_original_ft.account_id, NULL, NEW.created_by
      );
    END IF;

    IF v_original_ft.id IS NOT NULL THEN
      UPDATE public.financial_transactions
         SET status = 'refunded', updated_at = now()
       WHERE id = v_original_ft.id;
    END IF;

    IF NEW.cash_session_id IS NOT NULL THEN
      SELECT status INTO v_session_status
        FROM public.cash_sessions
       WHERE id = NEW.cash_session_id;

      IF v_session_status = 'open' AND v_amount > 0 THEN
        INSERT INTO public.cash_movements(
          session_id, company_id, type, amount, reason, note, created_by
        ) VALUES (
          NEW.cash_session_id, NEW.company_id, 'cash_out', v_amount,
          'sale_cancellation',
          'Estorno por cancelamento da venda ' || COALESCE(NEW.number, NEW.id::text),
          NEW.created_by
        );
      END IF;
    END IF;

    IF NEW.bella_pay_ref IS NOT NULL THEN
      UPDATE public.bella_pay_charges
         SET status = 'refunded',
             canceled_at = COALESCE(canceled_at, now()),
             updated_at = now()
       WHERE sale_id = NEW.id
         AND status NOT IN ('refunded', 'canceled');
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;