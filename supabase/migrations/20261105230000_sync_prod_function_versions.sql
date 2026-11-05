-- Sincronização código ↔ banco (05/11/2026).
-- Conferência do banco de produção mostrou 4 funções em que o BANCO estava
-- certo e o repositório desatualizado. Este arquivo grava no repositório a
-- versão que roda em produção (reaplicar não muda nada no banco):
--   · apply_sale_to_inventory: baixa estoque em venda paga E no crediário
--     (pending/partially_paid). A versão de 20260813112103 baixava só em
--     'paid' e quebraria o estoque do crediário — não reaplicar aquela.
--   · reverse_financial_transaction: bloqueia estorno de recebimento de
--     crediário pelo Financeiro.
--   · preview_duplicate_products, trg_cancel_credit_on_sale_cancel.

CREATE OR REPLACE FUNCTION public.apply_sale_to_inventory()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
BEGIN
  -- NOVA REGRA: Baixa estoque se:
  -- 1. A venda NÃO é rascunho (status != 'draft')
  -- 2. Ainda não foi aplicado (stock_applied = false)
  -- 3. NÃO é cancelada ou estornada (esses têm trigger de reversão)
  IF NEW.status IN ('paid', 'pending', 'partially_paid')
     AND COALESCE(NEW.stock_applied, false) = false THEN

    FOR item IN
      SELECT si.product_id, si.quantity
        FROM public.sale_items si
       WHERE si.sale_id = NEW.id
         AND si.product_id IS NOT NULL
    LOOP
      -- Registra a saída no estoque via motor de movimentos
      INSERT INTO public.inventory_movements(
        company_id, product_id, type, quantity,
        reason, notes, movement_date, user_id,
        source, reference_id, reference_number
      ) VALUES (
        NEW.company_id, item.product_id, 'out', item.quantity,
        'Venda',
        'Venda ' || COALESCE(NEW.number, NEW.id::text),
        COALESCE(NEW.sale_date, now()),
        NEW.created_by,
        'sale', NEW.id, NEW.number
      );
    END LOOP;

    -- Marca como aplicado para evitar duplicidade em futuros updates de status
    UPDATE public.sales SET stock_applied = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reverse_financial_transaction(_transaction_id uuid, _notes text DEFAULT NULL::text)
 RETURNS financial_transactions
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $fn$
DECLARE
  v_tx public.financial_transactions;
  v_account public.financial_accounts;
  v_session public.cash_sessions;
  v_amount numeric;
  v_discount numeric;
  v_audit text;
  v_was_paid boolean;
BEGIN
  SELECT * INTO v_tx FROM public.financial_transactions WHERE id = _transaction_id FOR UPDATE;
  IF v_tx.id IS NULL THEN
    RAISE EXCEPTION 'Lançamento financeiro não encontrado.';
  END IF;

  v_was_paid := (v_tx.paid_at IS NOT NULL);

  -- Recebimento de crediário não se estorna por aqui: o dinheiro sairia da
  -- conta, mas a parcela continuaria paga (crediário e caixa desencontrados).
  IF v_tx.source = 'credit_payment' AND (
       EXISTS (SELECT 1 FROM public.credit_payments cp WHERE cp.financial_transaction_id = v_tx.id)
    OR (v_was_paid AND EXISTS (SELECT 1 FROM public.credit_installments ci WHERE ci.id = v_tx.reference_id))
  ) THEN
    RAISE EXCEPTION 'Recebimento de crediário não pode ser estornado pelo Financeiro. Para desfazer, cancele a venda (o crediário é estornado junto).';
  END IF;

  IF v_tx.status NOT IN ('paid', 'pending', 'overdue') THEN
    RAISE EXCEPTION 'Lançamento não pode ser estornado no status atual (%).', v_tx.status;
  END IF;

  IF v_tx.status <> 'paid' AND v_was_paid THEN
    RAISE EXCEPTION 'Apenas lançamentos liquidados podem ser estornados.';
  END IF;

  v_amount := COALESCE(v_tx.amount, 0);
  v_discount := COALESCE(v_tx.discount_amount, 0);

  IF v_was_paid AND v_tx.account_id IS NOT NULL THEN
    SELECT * INTO v_account FROM public.financial_accounts WHERE id = v_tx.account_id;
  END IF;

  IF v_was_paid AND v_account.id IS NOT NULL AND v_account.type = 'cash' THEN
    SELECT * INTO v_session
    FROM public.cash_sessions
    WHERE company_id = v_tx.company_id AND status = 'open'
    ORDER BY opened_at DESC
    LIMIT 1;

    IF v_session.id IS NULL THEN
      RAISE EXCEPTION 'CAIXA_FECHADO: não é possível estornar um recebimento em Caixa sem uma sessão de caixa aberta.';
    END IF;

    INSERT INTO public.cash_movements (session_id, company_id, type, amount, reason, note, created_by, transaction_id)
    VALUES (
      v_session.id,
      v_tx.company_id,
      CASE WHEN v_tx.type = 'income' THEN 'cash_out' ELSE 'cash_in' END,
      v_amount,
      'Estorno de baixa financeira',
      COALESCE(NULLIF(btrim(COALESCE(_notes, '')), ''), v_tx.description),
      auth.uid(),
      _transaction_id
    )
    ON CONFLICT (transaction_id, type) WHERE transaction_id IS NOT NULL DO NOTHING;
  END IF;

  IF v_was_paid AND v_account.id IS NOT NULL THEN
    UPDATE public.financial_accounts
    SET current_balance = COALESCE(current_balance, 0)
        - CASE WHEN v_tx.type = 'income' THEN v_amount ELSE -v_amount END,
        updated_at = now()
    WHERE id = v_account.id;
  END IF;

  v_audit := format(
    '[estorno %s] baixa original: %s | forma: %s | conta: %s | valor: %s',
    to_char(now(), 'YYYY-MM-DD HH24:MI'),
    COALESCE(to_char(v_tx.paid_at, 'YYYY-MM-DD HH24:MI'), '—'),
    COALESCE(v_tx.payment_method, '—'),
    COALESCE(v_account.name, '—'),
    to_char(v_amount, 'FM999999990.00')
  );
  IF v_discount <> 0 THEN
    v_audit := v_audit || format(' | desconto revertido: %s', to_char(v_discount, 'FM999999990.00'));
  END IF;
  IF NULLIF(btrim(COALESCE(_notes, '')), '') IS NOT NULL THEN
    v_audit := v_audit || ' | motivo: ' || btrim(_notes);
  END IF;

  IF v_was_paid THEN
    UPDATE public.financial_transactions
    SET status = 'pending',
        paid_at = NULL,
        account_id = NULL,
        payment_method = NULL,
        settlement_session_id = NULL,
        -- restaura o valor cheio da obrigação (desfaz desconto/acréscimo da baixa)
        amount = ROUND(v_amount + v_discount, 2),
        discount_amount = 0,
        notes = btrim(COALESCE(notes || E'\n', '') || v_audit),
        updated_at = now()
    WHERE id = _transaction_id
    RETURNING * INTO v_tx;
  ELSE
    UPDATE public.financial_transactions
    SET status = 'cancelled',
        paid_at = NULL,
        notes = btrim(COALESCE(notes || E'\n', '') || v_audit),
        updated_at = now()
    WHERE id = _transaction_id
    RETURNING * INTO v_tx;
  END IF;

  RETURN v_tx;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.preview_duplicate_products(_company_id uuid)
RETURNS TABLE(name_key text, keeper_id uuid, keeper_name text, keeper_sku text, keeper_stock numeric, duplicates jsonb, merged_stock numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.user_has_company_access(_company_id) THEN
    RAISE EXCEPTION 'Acesso negado à empresa informada.';
  END IF;
  RETURN QUERY
  WITH base AS (
    SELECT p.id, p.name, p.sku, p.price, p.stock, p.created_at, p.cover_image_path,
           public.product_identity_key(p.name, p.model, p.color, p.size) AS nkey,
           EXISTS (SELECT 1 FROM public.product_images pi WHERE pi.product_id = p.id) AS has_image
    FROM public.products p
    WHERE p.company_id = _company_id AND coalesce(p.stock,0) > 0
      AND p.sku NOT LIKE '%-MERGED' AND p.sku NOT LIKE '%_MERGED'
  ),
  grouped AS (
    SELECT b.*, count(*) OVER (PARTITION BY b.nkey) AS grp_size,
           row_number() OVER (PARTITION BY b.nkey ORDER BY
             ((b.cover_image_path IS NOT NULL OR b.has_image))::int DESC,
             (coalesce(b.price,0) > 0)::int DESC, b.created_at ASC, b.id ASC) AS rn
    FROM base b WHERE b.nkey IS NOT NULL
  )
  SELECT g.nkey, k.id, k.name, k.sku, k.stock,
         jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'sku',g.sku,'price',g.price,'stock',g.stock,
           'has_image',(g.cover_image_path IS NOT NULL OR g.has_image),'created_at',g.created_at)
           ORDER BY g.created_at) FILTER (WHERE g.rn > 1),
         k.stock + coalesce(sum(g.stock) FILTER (WHERE g.rn > 1), 0)
  FROM grouped g JOIN grouped k ON k.nkey = g.nkey AND k.rn = 1
  WHERE g.grp_size > 1
  GROUP BY g.nkey, k.id, k.name, k.sku, k.stock;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.trg_cancel_credit_on_sale_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  -- Espelhos em aberto de qualquer parcela desta venda (a conta pode já
  -- ter sido cancelada pelo gatilho b_cancel_credit_account_on_sale_cancel).
  UPDATE public.financial_transactions t
     SET status = 'cancelled',
         notes = btrim(coalesce(t.notes || E'\n', '') ||
                 '[venda cancelada] saldo do crediário cancelado junto com a venda.'),
         updated_at = now()
   WHERE t.source = 'credit_payment'
     AND t.status IN ('pending', 'overdue')
     AND t.reference_id IN (
           SELECT i.id FROM public.credit_installments i
             JOIN public.credit_accounts a ON a.id = i.credit_account_id
            WHERE a.sale_id = NEW.id);

  -- Conta e parcelas (normalmente já canceladas pelo gatilho antigo).
  UPDATE public.credit_installments i
     SET status = 'cancelled', updated_at = now()
    FROM public.credit_accounts a
   WHERE a.id = i.credit_account_id AND a.sale_id = NEW.id
     AND i.status IN ('pending', 'partially_paid');

  UPDATE public.credit_accounts
     SET status = 'cancelled', cancelled_at = coalesce(cancelled_at, now()), updated_at = now()
   WHERE sale_id = NEW.id AND status NOT IN ('cancelled', 'settled');

  RETURN NULL;
END;
$fn$;
