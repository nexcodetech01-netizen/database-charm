CREATE OR REPLACE FUNCTION public.apply_sale_to_finance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_ft_id UUID;
  has_credit BOOLEAN;
BEGIN
  IF NEW.status = 'paid'
     AND (OLD.status IS DISTINCT FROM 'paid') THEN

    -- Se a venda tem crediário, o financeiro já é conduzido por credit_payments.
    SELECT EXISTS (
      SELECT 1 FROM public.credit_accounts WHERE sale_id = NEW.id
    ) INTO has_credit;

    IF has_credit THEN
      RETURN NEW;
    END IF;

    SELECT id INTO new_ft_id
      FROM public.financial_transactions
     WHERE source = 'sale' AND reference_id = NEW.id
     LIMIT 1;

    IF new_ft_id IS NULL THEN
      INSERT INTO public.financial_transactions(
        company_id, type, description, amount,
        transaction_date, due_date, paid_at, status,
        source, reference_id, reference_number, created_by
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
    ELSE
      -- Recebível já existia (venda "A Receber"): dar baixa na mesma transação.
      UPDATE public.financial_transactions
         SET status  = 'paid',
             paid_at = COALESCE(paid_at, NEW.paid_at, now()),
             amount  = COALESCE(NEW.grand_total, amount)
       WHERE id = new_ft_id
         AND status <> 'paid';
    END IF;

    IF NEW.finance_ref IS DISTINCT FROM new_ft_id THEN
      UPDATE public.sales SET finance_ref = new_ft_id WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;