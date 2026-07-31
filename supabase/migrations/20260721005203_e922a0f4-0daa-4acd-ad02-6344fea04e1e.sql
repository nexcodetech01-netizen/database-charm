
-- FIN-006 — Data prevista de recebimento por venda
-- Adiciona sales.due_date e propaga para o financial_transactions vinculado
-- (fluxo "A Receber"). O dashboard já trata "vencido" como due_date < hoje
-- estritamente, então o vencimento HOJE aparece como "A receber hoje".

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS due_date DATE;

CREATE OR REPLACE FUNCTION public.apply_receivable_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  existing_ft UUID;
  new_ft UUID;
  should_apply BOOLEAN := false;
  effective_due DATE;
BEGIN
  IF NEW.payment_method = 'a_receber' AND NEW.status = 'pending' THEN
    IF TG_OP = 'INSERT' THEN
      should_apply := true;
    ELSIF (OLD.status IS DISTINCT FROM NEW.status)
       OR (OLD.payment_method IS DISTINCT FROM NEW.payment_method) THEN
      should_apply := true;
    END IF;
  END IF;

  -- Sincroniza due_date do recebível quando a venda muda sales.due_date
  -- ou sales.sale_date, mesmo sem transição de status.
  IF TG_OP = 'UPDATE' AND NEW.finance_ref IS NOT NULL AND (
       OLD.due_date IS DISTINCT FROM NEW.due_date
    OR OLD.sale_date IS DISTINCT FROM NEW.sale_date
  ) THEN
    effective_due := COALESCE(NEW.due_date, NEW.sale_date, CURRENT_DATE);
    UPDATE public.financial_transactions
       SET due_date = effective_due,
           transaction_date = COALESCE(NEW.sale_date, transaction_date)
     WHERE id = NEW.finance_ref
       AND status <> 'paid';
  END IF;

  IF NOT should_apply THEN
    RETURN NEW;
  END IF;

  -- Baixa de estoque (idempotente)
  IF COALESCE(NEW.stock_applied, false) = false THEN
    FOR item IN
      SELECT si.product_id, si.quantity
        FROM public.sale_items si
       WHERE si.sale_id = NEW.id
         AND si.product_id IS NOT NULL
    LOOP
      INSERT INTO public.inventory_movements(
        company_id, product_id, type, quantity,
        reason, notes, movement_date, user_id,
        source, reference_id, reference_number
      ) VALUES (
        NEW.company_id, item.product_id, 'out', item.quantity,
        'Venda a receber',
        'Venda ' || COALESCE(NEW.number, NEW.id::text) || ' (A Receber)',
        now(),
        NEW.created_by,
        'sale', NEW.id, NEW.number
      );
    END LOOP;

    UPDATE public.sales SET stock_applied = true WHERE id = NEW.id;
  END IF;

  -- Lançamento em Contas a Receber (idempotente)
  SELECT id INTO existing_ft
    FROM public.financial_transactions
   WHERE source = 'sale' AND reference_id = NEW.id
   LIMIT 1;

  effective_due := COALESCE(NEW.due_date, NEW.sale_date, CURRENT_DATE);

  IF existing_ft IS NULL THEN
    INSERT INTO public.financial_transactions(
      company_id, type, description, amount,
      transaction_date, due_date, status,
      source, reference_id, reference_number, created_by
    ) VALUES (
      NEW.company_id,
      'income',
      'Venda Nº ' || COALESCE(NEW.number, NEW.id::text) || ' — A Receber',
      COALESCE(NEW.grand_total, 0),
      COALESCE(NEW.sale_date, CURRENT_DATE),
      effective_due,
      'pending',
      'sale',
      NEW.id,
      NEW.number,
      NEW.created_by
    )
    RETURNING id INTO new_ft;

    UPDATE public.sales SET finance_ref = new_ft WHERE id = NEW.id AND finance_ref IS DISTINCT FROM new_ft;
  ELSE
    UPDATE public.financial_transactions
       SET due_date = effective_due,
           transaction_date = COALESCE(NEW.sale_date, transaction_date)
     WHERE id = existing_ft
       AND status <> 'paid';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_receivable_sale() FROM PUBLIC;
