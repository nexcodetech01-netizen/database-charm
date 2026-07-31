
-- =========================================================
-- MOTOR CONTÁBIL — PARTE 2/2: postagem, integrações, relatórios
-- =========================================================

CREATE OR REPLACE FUNCTION public.accounting_post_entry(
  _company_id uuid,
  _entry_date date,
  _description text,
  _origin text,
  _origin_id uuid,
  _origin_event text,
  _document text,
  _items jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _entry_id uuid;
  _debit numeric(14,2) := 0;
  _credit numeric(14,2) := 0;
  _item jsonb;
  _account uuid;
  _amount numeric(14,2);
  _clean jsonb := '[]'::jsonb;
BEGIN
  IF _company_id IS NULL THEN RAISE EXCEPTION 'company_id obrigatório'; END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(COALESCE(_items, '[]'::jsonb)) LOOP
    _amount := ROUND(COALESCE((_item->>'amount')::numeric, 0), 2);
    IF _amount <= 0 THEN CONTINUE; END IF;
    _account := COALESCE(
      NULLIF(_item->>'account_id','')::uuid,
      public.accounting_account_id(_company_id, _item->>'code')
    );
    IF _account IS NULL THEN
      RAISE EXCEPTION 'Conta contábil não encontrada: %', COALESCE(_item->>'code', _item->>'account_id');
    END IF;
    IF (_item->>'side') = 'debit' THEN _debit := _debit + _amount;
    ELSIF (_item->>'side') = 'credit' THEN _credit := _credit + _amount;
    ELSE RAISE EXCEPTION 'Side inválido: %', _item->>'side';
    END IF;
    _clean := _clean || jsonb_build_array(jsonb_build_object(
      'account_id', _account, 'side', _item->>'side',
      'amount', _amount, 'memo', _item->>'memo'));
  END LOOP;

  IF jsonb_array_length(_clean) = 0 THEN RETURN NULL; END IF;
  IF ABS(_debit - _credit) > 0.009 THEN
    RAISE EXCEPTION 'Lançamento desbalanceado: débito % x crédito %', _debit, _credit;
  END IF;

  PERFORM set_config('nexos.accounting_posting', 'on', true);

  INSERT INTO public.accounting_entries (
    company_id, entry_date, description, origin, origin_id, origin_event,
    document, total_amount, created_by, hash
  ) VALUES (
    _company_id, COALESCE(_entry_date, CURRENT_DATE), _description, _origin, _origin_id,
    COALESCE(_origin_event,'default'), _document, _debit, auth.uid(),
    md5(_company_id::text || COALESCE(_entry_date, CURRENT_DATE)::text || _origin ||
        COALESCE(_origin_id::text,'') || COALESCE(_origin_event,'default') || _clean::text)
  )
  ON CONFLICT (company_id, origin, origin_id, origin_event) WHERE origin_id IS NOT NULL AND reversal_of IS NULL
  DO NOTHING
  RETURNING id INTO _entry_id;

  IF _entry_id IS NULL THEN
    PERFORM set_config('nexos.accounting_posting', 'off', true);
    RETURN NULL;
  END IF;

  INSERT INTO public.accounting_entry_items (entry_id, company_id, account_id, side, amount, memo)
  SELECT _entry_id, _company_id, (x->>'account_id')::uuid, x->>'side',
         (x->>'amount')::numeric, x->>'memo'
    FROM jsonb_array_elements(_clean) x;

  PERFORM set_config('nexos.accounting_posting', 'off', true);
  RETURN _entry_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accounting_post_entry(uuid,date,text,text,uuid,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accounting_post_entry(uuid,date,text,text,uuid,text,text,jsonb) TO service_role;

-- Estorno (nunca edição)
CREATE OR REPLACE FUNCTION public.accounting_reverse_origin(
  _company_id uuid, _origin text, _origin_id uuid, _reason text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; _new uuid; _count integer := 0;
BEGIN
  FOR e IN
    SELECT * FROM public.accounting_entries
     WHERE company_id = _company_id AND origin = _origin AND origin_id = _origin_id
       AND status = 'posted' AND reversal_of IS NULL
  LOOP
    PERFORM set_config('nexos.accounting_posting', 'on', true);
    INSERT INTO public.accounting_entries (
      company_id, entry_date, description, origin, origin_id, origin_event,
      document, status, reversal_of, total_amount, created_by, hash
    ) VALUES (
      e.company_id, CURRENT_DATE,
      'Estorno: ' || e.description || COALESCE(' — ' || _reason, ''),
      e.origin, e.origin_id, e.origin_event || ':reversal', e.document,
      'posted', e.id, e.total_amount, auth.uid(),
      md5(e.id::text || 'reversal' || now()::text)
    ) RETURNING id INTO _new;

    INSERT INTO public.accounting_entry_items (entry_id, company_id, account_id, side, amount, memo)
    SELECT _new, i.company_id, i.account_id,
           CASE WHEN i.side = 'debit' THEN 'credit' ELSE 'debit' END,
           i.amount, 'Estorno'
      FROM public.accounting_entry_items i WHERE i.entry_id = e.id;

    UPDATE public.accounting_entries SET status = 'reversed' WHERE id = e.id;
    PERFORM set_config('nexos.accounting_posting', 'off', true);
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.accounting_reverse_origin(uuid,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accounting_reverse_origin(uuid,text,uuid,text) TO service_role;

-- ---------------------------------------------------------
-- PARTE 5 — Integração automática
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_post_sale(_sale_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s record; _cogs numeric(14,2); _items jsonb;
BEGIN
  SELECT * INTO s FROM public.sales WHERE id = _sale_id;
  IF NOT FOUND OR COALESCE(s.is_test,false) THEN RETURN NULL; END IF;
  IF s.status NOT IN ('pending','partially_paid','paid') THEN RETURN NULL; END IF;

  SELECT COALESCE(SUM(COALESCE(si.total_cost, COALESCE(si.unit_cost,0) * si.quantity)), 0)
    INTO _cogs FROM public.sale_items si WHERE si.sale_id = s.id;

  _items := jsonb_build_array(
    jsonb_build_object('code','1.1.03','side','debit','amount', s.grand_total, 'memo','Contas a receber da venda'),
    jsonb_build_object('code','4.2.01','side','debit','amount', COALESCE(s.discount,0), 'memo','Desconto concedido'),
    jsonb_build_object('code','4.1.01','side','credit','amount', COALESCE(s.items_total,0) + COALESCE(s.shipping,0), 'memo','Receita bruta de vendas')
  );

  PERFORM public.accounting_post_entry(
    s.company_id, s.sale_date, 'Venda ' || COALESCE(s.number, s.id::text),
    'sale', s.id, 'revenue', s.number, _items);

  IF _cogs > 0 THEN
    PERFORM public.accounting_post_entry(
      s.company_id, s.sale_date, 'CMV da venda ' || COALESCE(s.number, s.id::text),
      'sale', s.id, 'cogs', s.number,
      jsonb_build_array(
        jsonb_build_object('code','5.1.01','side','debit','amount', _cogs, 'memo','Custo da mercadoria vendida'),
        jsonb_build_object('code','1.1.04','side','credit','amount', _cogs, 'memo','Baixa de estoque')
      ));
  END IF;
  RETURN _sale_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_sales_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF NEW.status = 'cancelled' THEN
      PERFORM public.accounting_reverse_origin(NEW.company_id, 'sale', NEW.id, 'Venda cancelada');
    ELSIF NEW.status IN ('pending','partially_paid','paid') THEN
      PERFORM public.accounting_post_sale(NEW.id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'accounting_sales_trigger falhou para venda %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_accounting_sales
  AFTER INSERT OR UPDATE OF status ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.accounting_sales_trigger();

-- Compras recebidas
CREATE OR REPLACE FUNCTION public.accounting_purchase_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF NEW.status = 'cancelled' THEN
      PERFORM public.accounting_reverse_origin(NEW.company_id, 'purchase', NEW.id, 'Compra cancelada');
    ELSIF NEW.received_at IS NOT NULL AND COALESCE(NEW.grand_total,0) > 0 THEN
      PERFORM public.accounting_post_entry(
        NEW.company_id, NEW.purchase_date, 'Compra ' || COALESCE(NEW.number, NEW.id::text),
        'purchase', NEW.id, 'receipt', NEW.number,
        jsonb_build_array(
          jsonb_build_object('code','1.1.04','side','debit','amount', NEW.grand_total,'memo','Entrada de estoque'),
          jsonb_build_object('code','2.1.01','side','credit','amount', NEW.grand_total,'memo','Fornecedores')
        ));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'accounting_purchase_trigger falhou para compra %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_accounting_purchases
  AFTER INSERT OR UPDATE OF status, received_at ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.accounting_purchase_trigger();

-- Recebimentos / pagamentos liquidados
CREATE OR REPLACE FUNCTION public.accounting_transaction_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _cash_code text; _acct_type text; _counter uuid; _counter_code text;
  _amount numeric(14,2); _discount numeric(14,2);
BEGIN
  BEGIN
    IF NEW.status <> 'paid' THEN
      IF TG_OP = 'UPDATE' AND OLD.status = 'paid' THEN
        PERFORM public.accounting_reverse_origin(NEW.company_id, 'financial_transaction', NEW.id, 'Baixa estornada');
      END IF;
      RETURN NEW;
    END IF;

    SELECT type INTO _acct_type FROM public.financial_accounts WHERE id = NEW.account_id;
    _cash_code := CASE WHEN COALESCE(_acct_type,'cash') = 'cash' THEN '1.1.01' ELSE '1.1.02' END;

    _amount := ROUND(COALESCE(NEW.amount,0), 2);
    _discount := ROUND(COALESCE(NEW.discount_amount,0), 2);
    IF _amount <= 0 THEN RETURN NEW; END IF;

    SELECT ac.code INTO _counter_code
      FROM public.financial_categories fc
      JOIN public.accounting_accounts ac ON ac.id = fc.accounting_account_id
     WHERE fc.id = NEW.category_id;

    IF NEW.type = 'income' THEN
      -- Receita já reconhecida na venda: baixa apenas reduz contas a receber
      IF NEW.source IN ('sale','credit_payment','sale_cancellation') THEN
        _counter_code := '1.1.03';
      ELSE
        _counter_code := COALESCE(_counter_code, '8.1.02');
      END IF;
      PERFORM public.accounting_post_entry(
        NEW.company_id, COALESCE(NEW.paid_at::date, NEW.transaction_date), 'Recebimento: ' || NEW.description,
        'financial_transaction', NEW.id, 'settlement', NEW.reference_number,
        jsonb_build_array(
          jsonb_build_object('code',_cash_code,'side','debit','amount', _amount - _discount,'memo','Entrada de caixa'),
          jsonb_build_object('code','4.2.01','side','debit','amount', _discount,'memo','Desconto concedido na baixa'),
          jsonb_build_object('code',_counter_code,'side','credit','amount', _amount,'memo','Baixa do recebível')
        ));
    ELSE
      IF NEW.source = 'purchase' THEN _counter_code := '2.1.01';
      ELSE _counter_code := COALESCE(_counter_code, '6.1.99');
      END IF;
      PERFORM public.accounting_post_entry(
        NEW.company_id, COALESCE(NEW.paid_at::date, NEW.transaction_date), 'Pagamento: ' || NEW.description,
        'financial_transaction', NEW.id, 'settlement', NEW.reference_number,
        jsonb_build_array(
          jsonb_build_object('code',_counter_code,'side','debit','amount', _amount,'memo','Despesa/obrigação'),
          jsonb_build_object('code',_cash_code,'side','credit','amount', _amount - _discount,'memo','Saída de caixa'),
          jsonb_build_object('code','8.1.02','side','credit','amount', _discount,'memo','Desconto obtido')
        ));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'accounting_transaction_trigger falhou para transação %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_accounting_transactions
  AFTER INSERT OR UPDATE OF status, amount, paid_at ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.accounting_transaction_trigger();

-- Suprimento / sangria (apenas movimentos sem transação financeira vinculada)
CREATE OR REPLACE FUNCTION public.accounting_cash_movement_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF NEW.transaction_id IS NOT NULL OR COALESCE(NEW.amount,0) <= 0 THEN RETURN NEW; END IF;
    IF NEW.type = 'cash_in' THEN
      PERFORM public.accounting_post_entry(
        NEW.company_id, NEW.created_at::date, 'Suprimento de caixa',
        'cash_movement', NEW.id, 'supply', NULL,
        jsonb_build_array(
          jsonb_build_object('code','1.1.01','side','debit','amount', NEW.amount,'memo', NEW.reason),
          jsonb_build_object('code','1.1.02','side','credit','amount', NEW.amount,'memo','Transferência de bancos')
        ));
    ELSE
      PERFORM public.accounting_post_entry(
        NEW.company_id, NEW.created_at::date, 'Sangria de caixa',
        'cash_movement', NEW.id, 'withdraw', NULL,
        jsonb_build_array(
          jsonb_build_object('code','1.1.02','side','debit','amount', NEW.amount,'memo','Transferência para bancos'),
          jsonb_build_object('code','1.1.01','side','credit','amount', NEW.amount,'memo', NEW.reason)
        ));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'accounting_cash_movement_trigger falhou para movimento %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_accounting_cash_movements
  AFTER INSERT ON public.cash_movements
  FOR EACH ROW EXECUTE FUNCTION public.accounting_cash_movement_trigger();

-- ---------------------------------------------------------
-- PARTE 6/7/8/9 — Relatórios
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_balances(
  _company_id uuid, _start date, _end date
) RETURNS TABLE(account_id uuid, code text, name text, type text, debit numeric, credit numeric, balance numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.code, a.name, a.type,
         COALESCE(SUM(CASE WHEN i.side='debit' THEN i.amount END),0),
         COALESCE(SUM(CASE WHEN i.side='credit' THEN i.amount END),0),
         CASE WHEN a.nature='debit'
              THEN COALESCE(SUM(CASE WHEN i.side='debit' THEN i.amount ELSE -i.amount END),0)
              ELSE COALESCE(SUM(CASE WHEN i.side='credit' THEN i.amount ELSE -i.amount END),0)
         END
    FROM public.accounting_accounts a
    LEFT JOIN public.accounting_entry_items i ON i.account_id = a.id
    LEFT JOIN public.accounting_entries e ON e.id = i.entry_id
     AND (_start IS NULL OR e.entry_date >= _start)
     AND (_end IS NULL OR e.entry_date <= _end)
   WHERE a.company_id = _company_id
     AND public.user_has_company_access(_company_id)
     AND (i.id IS NULL OR e.id IS NOT NULL)
   GROUP BY a.id, a.code, a.name, a.type, a.nature
$$;

GRANT EXECUTE ON FUNCTION public.accounting_balances(uuid,date,date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.generate_dre(_company_id uuid, _start date, _end date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _rev numeric := 0; _ded numeric := 0; _cmv numeric := 0; _opex numeric := 0;
  _fin numeric := 0; _other_rev numeric := 0; _other_exp numeric := 0; _depr numeric := 0;
  _net_rev numeric; _gross numeric; _op numeric; _before numeric; _net numeric; _ebitda numeric;
  _lines jsonb;
BEGIN
  IF NOT public.user_has_company_access(_company_id) THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  SELECT
    COALESCE(SUM(b.balance) FILTER (WHERE b.type='RECEITA'),0),
    COALESCE(SUM(b.balance) FILTER (WHERE b.type='DEDUCOES'),0),
    COALESCE(SUM(b.balance) FILTER (WHERE b.type='CMV'),0),
    COALESCE(SUM(b.balance) FILTER (WHERE b.type='DESPESA_OPERACIONAL'),0),
    COALESCE(SUM(b.balance) FILTER (WHERE b.type='DESPESA_FINANCEIRA'),0),
    COALESCE(SUM(b.balance) FILTER (WHERE b.type='OUTRAS_RECEITAS'),0),
    COALESCE(SUM(b.balance) FILTER (WHERE b.type='OUTRAS_DESPESAS'),0)
  INTO _rev, _ded, _cmv, _opex, _fin, _other_rev, _other_exp
  FROM public.accounting_balances(_company_id, _start, _end) b;

  SELECT COALESCE(SUM(b.balance),0) INTO _depr
    FROM public.accounting_balances(_company_id, _start, _end) b
    JOIN public.accounting_accounts a ON a.id = b.account_id
   WHERE a.is_depreciation;

  _net_rev := _rev - _ded;
  _gross   := _net_rev - _cmv;
  _op      := _gross - _opex;
  _before  := _op - _fin + _other_rev - _other_exp;
  _net     := _before;
  _ebitda  := _op + _depr;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'code', b.code, 'name', b.name, 'type', b.type, 'amount', b.balance)
           ORDER BY b.code), '[]'::jsonb)
    INTO _lines
    FROM public.accounting_balances(_company_id, _start, _end) b
   WHERE b.type IN ('RECEITA','DEDUCOES','CMV','DESPESA_OPERACIONAL','DESPESA_FINANCEIRA','OUTRAS_RECEITAS','OUTRAS_DESPESAS')
     AND b.balance <> 0;

  RETURN jsonb_build_object(
    'period', jsonb_build_object('start', _start, 'end', _end),
    'gross_revenue', ROUND(_rev,2),
    'deductions', ROUND(_ded,2),
    'net_revenue', ROUND(_net_rev,2),
    'cogs', ROUND(_cmv,2),
    'gross_profit', ROUND(_gross,2),
    'operating_expenses', ROUND(_opex,2),
    'operating_result', ROUND(_op,2),
    'financial_expenses', ROUND(_fin,2),
    'other_revenues', ROUND(_other_rev,2),
    'other_expenses', ROUND(_other_exp,2),
    'result_before_taxes', ROUND(_before,2),
    'net_profit', ROUND(_net,2),
    'depreciation', ROUND(_depr,2),
    'ebitda', ROUND(_ebitda,2),
    'gross_margin', CASE WHEN _net_rev > 0 THEN ROUND(_gross/_net_rev*100,2) ELSE 0 END,
    'operating_margin', CASE WHEN _net_rev > 0 THEN ROUND(_op/_net_rev*100,2) ELSE 0 END,
    'net_margin', CASE WHEN _net_rev > 0 THEN ROUND(_net/_net_rev*100,2) ELSE 0 END,
    'ebitda_margin', CASE WHEN _net_rev > 0 THEN ROUND(_ebitda/_net_rev*100,2) ELSE 0 END,
    'lines', _lines
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_dre(uuid,date,date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.generate_balance_sheet(_company_id uuid, _as_of date DEFAULT CURRENT_DATE)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _assets numeric := 0; _liab numeric := 0; _equity numeric := 0; _result numeric := 0;
  _lines jsonb;
BEGIN
  IF NOT public.user_has_company_access(_company_id) THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  SELECT
    COALESCE(SUM(b.balance) FILTER (WHERE b.type='ATIVO'),0),
    COALESCE(SUM(b.balance) FILTER (WHERE b.type='PASSIVO'),0),
    COALESCE(SUM(b.balance) FILTER (WHERE b.type='PATRIMONIO_LIQUIDO'),0),
    COALESCE(SUM(b.balance) FILTER (WHERE b.type IN ('RECEITA','OUTRAS_RECEITAS')),0)
      - COALESCE(SUM(b.balance) FILTER (WHERE b.type IN ('DEDUCOES','CMV','DESPESA_OPERACIONAL','DESPESA_FINANCEIRA','OUTRAS_DESPESAS')),0)
  INTO _assets, _liab, _equity, _result
  FROM public.accounting_balances(_company_id, NULL, _as_of) b;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'code', b.code, 'name', b.name, 'type', b.type, 'amount', b.balance) ORDER BY b.code), '[]'::jsonb)
    INTO _lines
    FROM public.accounting_balances(_company_id, NULL, _as_of) b
   WHERE b.type IN ('ATIVO','PASSIVO','PATRIMONIO_LIQUIDO') AND b.balance <> 0;

  RETURN jsonb_build_object(
    'as_of', _as_of,
    'assets', ROUND(_assets,2),
    'liabilities', ROUND(_liab,2),
    'equity', ROUND(_equity + _result,2),
    'equity_capital', ROUND(_equity,2),
    'period_result', ROUND(_result,2),
    'balanced', ABS(_assets - (_liab + _equity + _result)) <= 0.01,
    'difference', ROUND(_assets - (_liab + _equity + _result),2),
    'lines', _lines
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_balance_sheet(uuid,date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.financial_kpis(_company_id uuid, _start date, _end date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _dre jsonb; _bs jsonb;
  _current_assets numeric := 0; _current_liab numeric := 0; _assets numeric; _equity numeric;
  _sales_count integer := 0; _net_rev numeric; _net numeric; _cmv numeric; _opex numeric;
BEGIN
  IF NOT public.user_has_company_access(_company_id) THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  _dre := public.generate_dre(_company_id, _start, _end);
  _bs  := public.generate_balance_sheet(_company_id, _end);

  SELECT COALESCE(SUM(b.balance),0) INTO _current_assets
    FROM public.accounting_balances(_company_id, NULL, _end) b WHERE b.code LIKE '1.1%';
  SELECT COALESCE(SUM(b.balance),0) INTO _current_liab
    FROM public.accounting_balances(_company_id, NULL, _end) b WHERE b.code LIKE '2.1%';

  SELECT COUNT(*) INTO _sales_count FROM public.sales s
   WHERE s.company_id = _company_id AND NOT COALESCE(s.is_test,false)
     AND s.status IN ('pending','partially_paid','paid')
     AND s.sale_date BETWEEN _start AND _end;

  _assets  := (_bs->>'assets')::numeric;
  _equity  := (_bs->>'equity')::numeric;
  _net_rev := (_dre->>'net_revenue')::numeric;
  _net     := (_dre->>'net_profit')::numeric;
  _cmv     := (_dre->>'cogs')::numeric;
  _opex    := (_dre->>'operating_expenses')::numeric;

  RETURN jsonb_build_object(
    'period', jsonb_build_object('start', _start, 'end', _end),
    'current_liquidity', CASE WHEN _current_liab > 0 THEN ROUND(_current_assets/_current_liab,2) ELSE NULL END,
    'working_capital', ROUND(_current_assets - _current_liab,2),
    'debt_ratio', CASE WHEN _assets > 0 THEN ROUND(((_bs->>'liabilities')::numeric)/_assets*100,2) ELSE 0 END,
    'gross_margin', (_dre->>'gross_margin')::numeric,
    'operating_margin', (_dre->>'operating_margin')::numeric,
    'net_margin', (_dre->>'net_margin')::numeric,
    'ebitda', (_dre->>'ebitda')::numeric,
    'ebitda_margin', (_dre->>'ebitda_margin')::numeric,
    'roi', CASE WHEN _assets > 0 THEN ROUND(_net/_assets*100,2) ELSE 0 END,
    'roe', CASE WHEN _equity > 0 THEN ROUND(_net/_equity*100,2) ELSE 0 END,
    'average_ticket', CASE WHEN _sales_count > 0 THEN ROUND(_net_rev/_sales_count,2) ELSE 0 END,
    'sales_count', _sales_count,
    'cogs_ratio', CASE WHEN _net_rev > 0 THEN ROUND(_cmv/_net_rev*100,2) ELSE 0 END,
    'expense_ratio', CASE WHEN _net_rev > 0 THEN ROUND(_opex/_net_rev*100,2) ELSE 0 END,
    'break_even', CASE WHEN _net_rev > 0 AND (_net_rev - _cmv) > 0
                       THEN ROUND(_opex / ((_net_rev - _cmv)/_net_rev),2) ELSE 0 END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.financial_kpis(uuid,date,date) TO authenticated, service_role;
