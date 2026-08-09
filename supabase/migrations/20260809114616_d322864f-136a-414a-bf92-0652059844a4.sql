CREATE OR REPLACE FUNCTION public.trg_notify_finance_overview_on_account_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Notifica o canal finance_overview quando o status ou o saldo de uma conta mudar
  -- Isso permite que o frontend invalide o cache e recalcule o card "Caixa Disponível"
  PERFORM pg_notify('finance_overview', json_build_object(
    'company_id', COALESCE(NEW.company_id, OLD.company_id),
    'account_id', COALESCE(NEW.id, OLD.id),
    'status', NEW.status,
    'current_balance', NEW.current_balance
  )::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_account_overview_sync ON public.financial_accounts;

CREATE TRIGGER trg_finance_account_overview_sync
AFTER UPDATE OF status, current_balance ON public.financial_accounts
FOR EACH ROW
EXECUTE FUNCTION public.trg_notify_finance_overview_on_account_change();