
-- 1) Ampliar o CHECK de payment_method para incluir 'a_receber'
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
ALTER TABLE public.sales
  ADD CONSTRAINT sales_payment_method_check
  CHECK (payment_method IS NULL OR payment_method = ANY (ARRAY[
    'pix'::text,
    'pix_manual'::text,
    'cash'::text,
    'card'::text,
    'credit_card'::text,
    'debit_card'::text,
    'payment_link'::text,
    'bella_pay'::text,
    'a_receber'::text
  ]));

-- 2) Função dedicada ao fluxo "A Receber"
-- - Baixa estoque (idempotente via sales.stock_applied)
-- - Cria financial_transactions income/pending (idempotente via source+reference_id)
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
BEGIN
  IF NEW.payment_method = 'a_receber' AND NEW.status = 'pending' THEN
    IF TG_OP = 'INSERT' THEN
      should_apply := true;
    ELSIF (OLD.status IS DISTINCT FROM NEW.status)
       OR (OLD.payment_method IS DISTINCT FROM NEW.payment_method) THEN
      should_apply := true;
    END IF;
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
      COALESCE(NEW.sale_date, CURRENT_DATE),
      'pending',
      'sale',
      NEW.id,
      NEW.number,
      NEW.created_by
    )
    RETURNING id INTO new_ft;

    UPDATE public.sales SET finance_ref = new_ft WHERE id = NEW.id AND finance_ref IS DISTINCT FROM new_ft;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_receivable_sale() FROM PUBLIC;

DROP TRIGGER IF EXISTS apply_receivable_sale_trg ON public.sales;
CREATE TRIGGER apply_receivable_sale_trg
  AFTER INSERT OR UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.apply_receivable_sale();
