
CREATE OR REPLACE FUNCTION public.apply_purchase_to_finance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_ft_id UUID;
BEGIN
  IF NEW.status = 'received'
     AND (OLD.status IS DISTINCT FROM 'received') THEN

    -- Idempotência
    SELECT id INTO new_ft_id
      FROM public.financial_transactions
     WHERE source = 'purchase' AND reference_id = NEW.id
     LIMIT 1;

    IF new_ft_id IS NULL THEN
      INSERT INTO public.financial_transactions(
        company_id, type, description, amount,
        transaction_date, due_date, status,
        source, reference_id, reference_number,
        created_by
      ) VALUES (
        NEW.company_id, 'expense',
        'Compra Nº ' || COALESCE(NEW.number, NEW.id::text),
        COALESCE(NEW.grand_total, 0),
        COALESCE(NEW.purchase_date, CURRENT_DATE),
        COALESCE(NEW.purchase_date, CURRENT_DATE),
        'pending',
        'purchase', NEW.id, NEW.number,
        NEW.created_by
      )
      RETURNING id INTO new_ft_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_purchase_to_finance ON public.purchases;
CREATE TRIGGER trg_apply_purchase_to_finance
AFTER UPDATE OF status ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.apply_purchase_to_finance();
