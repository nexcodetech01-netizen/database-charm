-- =====================================================================
-- Status de pagamento da venda: UMA fonte da verdade (08/10/2026)
--
-- Problema: o status da venda (Pendente / Parcialmente paga / Paga) era
-- gravado por vários pedaços do sistema (telas, crediário, baixa do
-- Financeiro, Bella Pay). Quando um errava, a venda dizia uma coisa e o
-- dinheiro outra (raio-X de 08/10 achou 13 vendas assim).
--
-- Agora:
--   1. compute_sale_payment_status() calcula o status A PARTIR DO DINHEIRO:
--        · crediário  → saldo da conta de crediário
--        · demais     → recebimentos pagos ligados à venda (título da venda,
--                       finance_ref ou cobrança Bella Pay)
--   2. Gatilho em sales impede gravar "Paga" sem o dinheiro e acerta
--      Pendente × Parcialmente paga.
--   3. Gatilhos em financial_transactions e credit_accounts recalculam o
--      status sempre que o dinheiro muda.
--   4. apply_sale_settlement_discount(): desconto dado na baixa vira
--      desconto da venda (antes ficava só na observação e a venda ficava
--      "parcialmente paga" para sempre).
--   5. finance_consistency_issues(): o raio-X, para alerta automático.
--
-- Só ADICIONA funções e gatilhos; nenhuma função existente é substituída.
-- =====================================================================

-- 1) Cálculo -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_sale_payment_status(
  _sale_id uuid,
  _total numeric DEFAULT NULL
)
RETURNS TABLE(status text, paid_at timestamptz, received numeric, remaining numeric, has_money_trail boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_total numeric;
  v_finance_ref uuid;
  v_acc public.credit_accounts%ROWTYPE;
  v_received numeric := 0;
  v_paid_at timestamptz;
  v_trail boolean := false;
BEGIN
  SELECT coalesce(_total, s.grand_total, 0), s.finance_ref
    INTO v_total, v_finance_ref
    FROM public.sales s WHERE s.id = _sale_id;

  SELECT * INTO v_acc FROM public.credit_accounts ca
   WHERE ca.sale_id = _sale_id AND ca.status <> 'cancelled'
   ORDER BY ca.created_at DESC LIMIT 1;

  IF v_acc.id IS NOT NULL THEN
    -- Crediário: o saldo da conta é a fonte da verdade.
    remaining := greatest(coalesce(v_acc.balance, 0), 0);
    v_received := greatest(v_total - remaining, 0);
    v_paid_at := coalesce(
      v_acc.settled_at,
      (SELECT max(cp.paid_at) FROM public.credit_payments cp WHERE cp.credit_account_id = v_acc.id));
    v_trail := true;
  ELSE
    -- Rastro conta também títulos cancelados: estornar o recebimento de
    -- uma venda paga a devolve para "Pendente".
    SELECT coalesce(sum(t.amount) FILTER (WHERE t.status = 'paid'), 0),
           max(t.paid_at) FILTER (WHERE t.status = 'paid'),
           count(*) > 0
      INTO v_received, v_paid_at, v_trail
      FROM public.financial_transactions t
     WHERE t.type = 'income'
       AND (
         t.reference_id = _sale_id
         OR (v_finance_ref IS NOT NULL AND t.id = v_finance_ref)
         OR t.bella_pay_charge_id IN (SELECT c.id FROM public.bella_pay_charges c WHERE c.sale_id = _sale_id)
       );
    remaining := greatest(v_total - v_received, 0);
  END IF;

  received := v_received;
  paid_at := v_paid_at;
  has_money_trail := v_trail;
  status := CASE
    WHEN remaining <= 0.009 THEN 'paid'
    WHEN v_received > 0.009 THEN 'partially_paid'
    ELSE 'pending'
  END;
  RETURN NEXT;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.compute_sale_payment_status(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_sale_payment_status(uuid, numeric) TO authenticated, service_role;

-- 2) Guarda na venda ---------------------------------------------------
-- Só age entre os estados de pagamento (Pendente/Parcial/Paga) e só em
-- vendas que têm rastro de dinheiro (crediário ou título). Nunca promove
-- para "Paga" aqui — isso fica com o recálculo do item 3, que roda quando
-- o dinheiro entra.
CREATE OR REPLACE FUNCTION public.trg_guard_sale_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c record;
BEGIN
  IF OLD.status NOT IN ('pending', 'partially_paid', 'paid')
     OR NEW.status NOT IN ('pending', 'partially_paid', 'paid') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO c FROM public.compute_sale_payment_status(NEW.id, NEW.grand_total);
  IF NOT coalesce(c.has_money_trail, false) THEN
    RETURN NEW;
  END IF;

  IF c.status <> 'paid' AND NEW.status IS DISTINCT FROM c.status THEN
    NEW.status := c.status;
    IF c.status = 'pending' THEN
      NEW.paid_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_0_guard_sale_payment_status ON public.sales;
CREATE TRIGGER trg_0_guard_sale_payment_status
  BEFORE UPDATE OF status ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.trg_guard_sale_payment_status();

-- 3) Recálculo quando o dinheiro muda ----------------------------------
CREATE OR REPLACE FUNCTION public.sync_sale_payment_status(_sale_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
  c record;
BEGIN
  IF _sale_id IS NULL THEN RETURN; END IF;
  SELECT s.status INTO v_status FROM public.sales s WHERE s.id = _sale_id;
  IF v_status IS NULL OR v_status NOT IN ('pending', 'partially_paid', 'paid') THEN
    RETURN;
  END IF;

  SELECT * INTO c FROM public.compute_sale_payment_status(_sale_id);
  IF NOT coalesce(c.has_money_trail, false) OR c.status = v_status THEN
    RETURN;
  END IF;

  -- Nunca derruba quem disparou o gatilho (baixa, webhook, crediário):
  -- se outra regra recusar, só registra o aviso.
  BEGIN
    UPDATE public.sales
       SET status = c.status,
           paid_at = CASE WHEN c.status = 'paid' THEN coalesce(c.paid_at, now()) ELSE paid_at END,
           updated_at = now()
     WHERE id = _sale_id;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'sync_sale_payment_status(%): %', _sale_id, SQLERRM;
  END;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.sync_sale_payment_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_sale_payment_status(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_tx_sync_sale_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.financial_transactions%ROWTYPE;
  v_sale uuid;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  IF v_row.type IS DISTINCT FROM 'income' THEN
    RETURN NULL;
  END IF;

  -- Venda ligada pelo título, pelo finance_ref ou pela cobrança Bella Pay
  SELECT s.id INTO v_sale FROM public.sales s
   WHERE s.id = v_row.reference_id OR s.finance_ref = v_row.id
   LIMIT 1;
  IF v_sale IS NULL AND v_row.bella_pay_charge_id IS NOT NULL THEN
    SELECT c.sale_id INTO v_sale FROM public.bella_pay_charges c WHERE c.id = v_row.bella_pay_charge_id;
  END IF;

  PERFORM public.sync_sale_payment_status(v_sale);
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_tx_sync_sale_payment_status ON public.financial_transactions;
CREATE TRIGGER trg_tx_sync_sale_payment_status
  AFTER INSERT OR DELETE OR UPDATE OF status, amount, reference_id ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_tx_sync_sale_payment_status();

CREATE OR REPLACE FUNCTION public.trg_credit_sync_sale_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.sync_sale_payment_status(NEW.sale_id);
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_credit_sync_sale_payment_status ON public.credit_accounts;
CREATE TRIGGER trg_credit_sync_sale_payment_status
  AFTER UPDATE OF balance, status ON public.credit_accounts
  FOR EACH ROW EXECUTE FUNCTION public.trg_credit_sync_sale_payment_status();

-- 4) Desconto dado na baixa vira desconto da venda ----------------------
CREATE OR REPLACE FUNCTION public.apply_sale_settlement_discount(
  _transaction_id uuid,
  _discount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tx public.financial_transactions%ROWTYPE;
  v_d numeric := round(coalesce(_discount, 0), 2);
BEGIN
  SELECT * INTO v_tx FROM public.financial_transactions WHERE id = _transaction_id FOR UPDATE;
  IF v_tx.id IS NULL THEN
    RAISE EXCEPTION 'Lançamento não encontrado.';
  END IF;
  IF auth.uid() IS NULL OR NOT public.user_has_company_access(v_tx.company_id) THEN
    RAISE EXCEPTION 'Acesso negado a esta empresa' USING ERRCODE = '42501';
  END IF;
  IF v_tx.type <> 'income' OR v_tx.status NOT IN ('pending', 'overdue') THEN
    RAISE EXCEPTION 'Só é possível dar desconto em um recebimento em aberto.';
  END IF;
  IF v_d <= 0 OR v_d >= v_tx.amount THEN
    RAISE EXCEPTION 'Desconto inválido.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sales s
                  WHERE s.id = v_tx.reference_id AND s.status IN ('pending', 'partially_paid')) THEN
    RAISE EXCEPTION 'Este lançamento não pertence a uma venda em aberto.';
  END IF;

  UPDATE public.sales
     SET discount = coalesce(discount, 0) + v_d,
         grand_total = greatest(grand_total - v_d, 0),
         notes = trim(both ' ' from coalesce(notes, '') || ' Desconto de R$ '
                 || replace(to_char(v_d, 'FM999999990.00'), '.', ',') || ' concedido no recebimento.'),
         updated_at = now()
   WHERE id = v_tx.reference_id;

  UPDATE public.financial_transactions
     SET amount = amount - v_d,
         notes = trim(both ' ' from coalesce(notes, '') || ' Desconto de R$ '
                 || replace(to_char(v_d, 'FM999999990.00'), '.', ',') || ' aplicado na venda.'),
         updated_at = now()
   WHERE id = v_tx.id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.apply_sale_settlement_discount(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_sale_settlement_discount(uuid, numeric) TO authenticated;

-- 5) Raio-X: inconsistências entre venda, crediário e Financeiro -------
CREATE OR REPLACE FUNCTION public.finance_consistency_issues(_company_id uuid)
RETURNS TABLE(problem text, sale_id uuid, sale_number text, customer text, sale_status text, total numeric, detail text)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
#variable_conflict use_column
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_has_company_access(_company_id) THEN
    RAISE EXCEPTION 'Acesso negado a esta empresa' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH s AS (
    SELECT s.id, s.number::text AS number, s.status::text AS status, s.grand_total, c.name::text AS cliente
      FROM public.sales s LEFT JOIN public.customers c ON c.id = s.customer_id
     WHERE s.company_id = _company_id
       AND s.deleted_at IS NULL AND coalesce(s.is_test, false) = false
       AND s.status NOT IN ('cancelled', 'draft')
  ),
  ca AS (SELECT a.sale_id, a.balance FROM public.credit_accounts a WHERE a.status <> 'cancelled'),
  paid AS (
    SELECT t.reference_id AS sid, sum(t.amount) AS tot FROM public.financial_transactions t
     WHERE t.company_id = _company_id AND t.type = 'income' AND t.source = 'sale' AND t.status = 'paid'
     GROUP BY 1
  ),
  pend AS (
    SELECT t.reference_id AS sid, sum(t.amount) AS tot FROM public.financial_transactions t
     WHERE t.company_id = _company_id AND t.type = 'income' AND t.source = 'sale'
       AND t.status IN ('pending', 'overdue')
     GROUP BY 1
  ),
  cp_paid AS (
    SELECT a.sale_id AS sid, sum(t.amount) AS tot
      FROM (SELECT DISTINCT p.credit_account_id, p.financial_transaction_id FROM public.credit_payments p) x
      JOIN public.credit_accounts a ON a.id = x.credit_account_id
      JOIN public.financial_transactions t ON t.id = x.financial_transaction_id
     WHERE t.status = 'paid' AND t.source <> 'sale'
     GROUP BY 1
  ),
  v AS (
    SELECT s.*, ca.balance, (ca.sale_id IS NOT NULL) AS crediario,
           coalesce(paid.tot, 0) AS recebido_venda,
           coalesce(pend.tot, 0) AS pendente,
           coalesce(paid.tot, 0) + coalesce(cp_paid.tot, 0) AS recebido_total
      FROM s
      LEFT JOIN ca ON ca.sale_id = s.id
      LEFT JOIN paid ON paid.sid = s.id
      LEFT JOIN pend ON pend.sid = s.id
      LEFT JOIN cp_paid ON cp_paid.sid = s.id
  )
  SELECT x.problem, x.id, x.number, x.cliente, x.status, x.grand_total, x.detail FROM (
    SELECT 'Paga, mas crediário com saldo'::text AS problem, v.*, ('saldo ' || v.balance)::text AS detail
      FROM v WHERE v.crediario AND v.status = 'paid' AND v.balance > 0.009
    UNION ALL
    SELECT 'Crediário quitado, venda em aberto', v.*, 'saldo 0'
      FROM v WHERE v.crediario AND v.status IN ('pending', 'partially_paid') AND v.balance <= 0.009
    UNION ALL
    SELECT 'Crediário com título duplicado no Financeiro', v.*, 'título pendente ' || v.pendente
      FROM v WHERE v.crediario AND v.pendente > 0.009
    UNION ALL
    SELECT 'Recebido em dobro (crediário)', v.*,
           'recebido ' || v.recebido_total || ', crediário diz ' || (v.grand_total - v.balance)
      FROM v WHERE v.crediario AND v.recebido_total > (v.grand_total - v.balance) + 0.009
    UNION ALL
    SELECT 'Crediário abatido sem entrada no Financeiro', v.*,
           'recebido ' || v.recebido_total || ', crediário diz ' || (v.grand_total - v.balance)
      FROM v WHERE v.crediario AND v.recebido_total < (v.grand_total - v.balance) - 0.009
    UNION ALL
    SELECT 'Paga sem recebimento', v.*, 'recebido 0'
      FROM v WHERE NOT v.crediario AND v.status = 'paid' AND v.recebido_venda <= 0.009
    UNION ALL
    SELECT 'Paga com recebido menor que o total', v.*,
           'recebido ' || v.recebido_venda || ' de ' || v.grand_total
      FROM v WHERE NOT v.crediario AND v.status = 'paid'
               AND v.recebido_venda > 0.009 AND v.recebido_venda < v.grand_total - 0.009
    UNION ALL
    SELECT 'Recebido cobre o total, venda em aberto', v.*, 'recebido ' || v.recebido_venda
      FROM v WHERE NOT v.crediario AND v.status IN ('pending', 'partially_paid')
               AND v.recebido_venda >= v.grand_total - 0.009
    UNION ALL
    SELECT 'Em aberto sem nada a receber registrado', v.*,
           'recebido ' || v.recebido_venda || ', pendente 0'
      FROM v WHERE NOT v.crediario AND v.status IN ('pending', 'partially_paid')
               AND v.pendente <= 0.009 AND v.recebido_venda < v.grand_total - 0.009
  ) x
  ORDER BY x.problem, x.number;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.finance_consistency_issues(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_consistency_issues(uuid) TO authenticated;
