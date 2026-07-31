CREATE OR REPLACE FUNCTION public.seed_default_financial_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.financial_accounts WHERE company_id = NEW.id
  ) THEN
    INSERT INTO public.financial_accounts (company_id, name, type, initial_balance, current_balance, status)
    VALUES (NEW.id, 'Caixa Principal', 'cash', 0, 0, 'active');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_financial_account ON public.companies;
CREATE TRIGGER trg_seed_default_financial_account
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.seed_default_financial_account();

INSERT INTO public.financial_accounts (company_id, name, type, initial_balance, current_balance, status)
SELECT c.id, 'Caixa Principal', 'cash', 0, 0, 'active'
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.financial_accounts fa WHERE fa.company_id = c.id
);