-- Vale-troca preso em rascunho (26/10/2026).
-- Fechar o checkout sem pagar devolve a venda para "rascunho", mas o vale
-- continuava reservado nela; ao finalizar de novo, dava "saldo de
-- vale-troca insuficiente". Agora rascunho não segura o vale.

CREATE OR REPLACE FUNCTION public.sync_sale_store_credit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_desired numeric(12,2);
  v_current numeric(12,2);
  v_delta numeric(12,2);
  v_balance numeric(12,2);
BEGIN
  v_desired := CASE
    -- Rascunho (checkout fechado sem pagar, venda suspensa) não segura o
    -- vale: ele volta ao saldo e é debitado de novo ao finalizar.
    WHEN NEW.status IN ('cancelled', 'draft') OR NEW.deleted_at IS NOT NULL THEN 0
    ELSE COALESCE(NEW.store_credit_used, 0)
  END;

  SELECT -COALESCE(sum(amount), 0) INTO v_current
    FROM public.customer_store_credit_entries
   WHERE sale_id = NEW.id AND kind IN ('sale_use', 'sale_cancel');

  v_delta := v_desired - v_current;
  IF abs(v_delta) < 0.005 THEN
    RETURN NEW;
  END IF;

  IF v_delta > 0 THEN
    IF NEW.customer_id IS NULL THEN
      RAISE EXCEPTION 'Para usar vale-troca, escolha a cliente na venda.';
    END IF;
    -- Trava a cliente: dois caixas não gastam o mesmo saldo.
    PERFORM 1 FROM public.customers WHERE id = NEW.customer_id FOR UPDATE;
    SELECT COALESCE(sum(amount), 0) INTO v_balance
      FROM public.customer_store_credit_entries
     WHERE customer_id = NEW.customer_id;
    IF v_balance + 0.005 < v_delta THEN
      RAISE EXCEPTION 'Saldo de vale-troca insuficiente (disponível: R$ %).',
        to_char(v_balance, 'FM999999990.00');
    END IF;
    INSERT INTO public.customer_store_credit_entries (company_id, customer_id, amount, kind, sale_id, notes)
    VALUES (NEW.company_id, NEW.customer_id, -v_delta, 'sale_use', NEW.id,
            'Usado na venda ' || COALESCE(NEW.number, NEW.id::text));
  ELSE
    INSERT INTO public.customer_store_credit_entries (company_id, customer_id, amount, kind, sale_id, notes)
    SELECT NEW.company_id, e.customer_id, -v_delta, 'sale_cancel', NEW.id,
           'Devolvido ao saldo (venda ' || COALESCE(NEW.number, NEW.id::text) || ')'
      FROM public.customer_store_credit_entries e
     WHERE e.sale_id = NEW.id AND e.kind = 'sale_use'
     ORDER BY e.created_at
     LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

-- Libera o vale dos rascunhos que já existem.
UPDATE public.sales
   SET store_credit_used = store_credit_used
 WHERE status = 'draft' AND COALESCE(store_credit_used, 0) > 0;
