-- ============================================================
-- Consolidação: ensure_sale_receivable() é o único criador de
-- recebíveis (financial_transactions source='sale').
-- ============================================================

-- 1) apply_receivable_sale(): mantém estoque + sync de vencimento.
--    A criação do recebível é delegada a ensure_sale_receivable().
CREATE OR REPLACE FUNCTION public.apply_receivable_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
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

  -- Sincroniza due_date do recebível quando a venda muda due_date/sale_date.
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

  -- Baixa de estoque (idempotente) — responsabilidade própria da trigger.
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

  -- Recebível: ponto único. Crediário é conduzido pelo próprio módulo.
  IF NOT EXISTS (SELECT 1 FROM public.credit_accounts WHERE sale_id = NEW.id) THEN
    PERFORM public.ensure_sale_receivable(NEW.id);

    -- Mantém due_date coerente com a venda (ensure_ é idempotente e não
    -- reescreve títulos já existentes).
    effective_due := COALESCE(NEW.due_date, NEW.sale_date, CURRENT_DATE);
    UPDATE public.financial_transactions
       SET due_date = effective_due,
           transaction_date = COALESCE(NEW.sale_date, transaction_date)
     WHERE source = 'sale' AND reference_id = NEW.id
       AND status <> 'paid';
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) apply_sale_to_finance(): deixa de criar recebíveis.
--    Passa a somente vincular sales.finance_ref ao título existente.
CREATE OR REPLACE FUNCTION public.apply_sale_to_finance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ft_id UUID;
BEGIN
  -- Este trigger NÃO cria mais financial_transactions.
  -- Criação de recebível: exclusivamente public.ensure_sale_receivable().
  -- Baixa: exclusivamente public.settle_financial_transaction().
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    SELECT id INTO v_ft_id
      FROM public.financial_transactions
     WHERE source = 'sale' AND reference_id = NEW.id
     ORDER BY created_at ASC
     LIMIT 1;

    IF v_ft_id IS NOT NULL AND NEW.finance_ref IS DISTINCT FROM v_ft_id THEN
      UPDATE public.sales SET finance_ref = v_ft_id WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;