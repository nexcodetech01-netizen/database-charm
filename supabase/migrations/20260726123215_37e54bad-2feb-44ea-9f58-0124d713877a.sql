CREATE OR REPLACE FUNCTION public.enforce_paid_transaction_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_missing text[] := '{}';
BEGIN
  IF NEW.status IS DISTINCT FROM 'paid' THEN
    RETURN NEW;
  END IF;

  -- Grandfathering: registros legados já 'paid' e incompletos permanecem
  -- editáveis desde que os campos de liquidação não sejam alterados.
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'paid'
     AND OLD.paid_at IS NOT DISTINCT FROM NEW.paid_at
     AND OLD.account_id IS NOT DISTINCT FROM NEW.account_id
     AND OLD.payment_method IS NOT DISTINCT FROM NEW.payment_method THEN
    RETURN NEW;
  END IF;

  IF NEW.paid_at IS NULL THEN v_missing := v_missing || 'paid_at'; END IF;
  IF NEW.account_id IS NULL THEN v_missing := v_missing || 'account_id'; END IF;
  IF NEW.payment_method IS NULL THEN v_missing := v_missing || 'payment_method'; END IF;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION
      'LIQUIDACAO_INVALIDA: lançamento não pode ficar como pago sem %. Use settle_financial_transaction().',
      array_to_string(v_missing, ', ')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_paid_transaction_integrity ON public.financial_transactions;

CREATE TRIGGER trg_enforce_paid_transaction_integrity
BEFORE INSERT OR UPDATE ON public.financial_transactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_paid_transaction_integrity();