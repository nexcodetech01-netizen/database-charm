
CREATE OR REPLACE FUNCTION public.apply_sale_to_finance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_ft_id UUID;
BEGIN
  IF NEW.status = 'paid'
     AND (OLD.status IS DISTINCT FROM 'paid') THEN

    -- Idempotência: se já existe lançamento para esta venda, apenas garante finance_ref e sai.
    SELECT id INTO new_ft_id
      FROM public.financial_transactions
     WHERE source = 'sale' AND reference_id = NEW.id
     LIMIT 1;

    IF new_ft_id IS NULL THEN
      INSERT INTO public.financial_transactions(
        company_id, type, description, amount,
        transaction_date, due_date, paid_at, status,
        source, reference_id, reference_number,
        created_by
      ) VALUES (
        NEW.company_id, 'income',
        'Venda Nº ' || COALESCE(NEW.number, NEW.id::text),
        COALESCE(NEW.grand_total, 0),
        COALESCE(NEW.sale_date, CURRENT_DATE),
        COALESCE(NEW.sale_date, CURRENT_DATE),
        COALESCE(NEW.paid_at, now()),
        'paid',
        'sale', NEW.id, NEW.number,
        NEW.created_by
      )
      RETURNING id INTO new_ft_id;
    END IF;

    IF NEW.finance_ref IS DISTINCT FROM new_ft_id THEN
      UPDATE public.sales SET finance_ref = new_ft_id WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_sale_to_finance ON public.sales;
CREATE TRIGGER trg_apply_sale_to_finance
AFTER UPDATE OF status ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.apply_sale_to_finance();
