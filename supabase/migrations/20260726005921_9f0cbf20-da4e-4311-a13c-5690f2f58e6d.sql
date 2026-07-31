CREATE OR REPLACE FUNCTION public.apply_sale_to_finance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_ft_id UUID;
  has_credit BOOLEAN;
BEGIN
  -- ETAPA 1 — Estabilização do PDV.
  -- Este trigger NÃO executa mais nenhuma baixa financeira.
  -- Ele apenas garante a existência do recebível PENDENTE da venda.
  -- A baixa (status='paid', payment_method, account_id, cash_movement e
  -- financial_accounts.current_balance) é exclusividade da RPC
  -- public.settle_financial_transaction.
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN

    -- Crediário é conduzido por credit_payments — não criar recebível aqui.
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
        transaction_date, due_date, status,
        source, reference_id, reference_number, created_by
      ) VALUES (
        NEW.company_id, 'income',
        'Venda Nº ' || COALESCE(NEW.number, NEW.id::text),
        COALESCE(NEW.grand_total, 0),
        COALESCE(NEW.sale_date, CURRENT_DATE),
        COALESCE(NEW.due_date, NEW.sale_date, CURRENT_DATE),
        'pending',
        'sale', NEW.id, NEW.number,
        NEW.created_by
      )
      RETURNING id INTO new_ft_id;
    END IF;
    -- Recebível já existente: NÃO alterar status/paid_at/amount.

    IF NEW.finance_ref IS DISTINCT FROM new_ft_id THEN
      UPDATE public.sales SET finance_ref = new_ft_id WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;