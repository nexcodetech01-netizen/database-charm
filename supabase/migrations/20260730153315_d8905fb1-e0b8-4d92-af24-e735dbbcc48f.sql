-- ============================================================
-- SPRINT P0.3 — Motor Tributário Enterprise
-- ============================================================

-- ---------- PARTE 1: tabela de faixas do Simples (referência) ----------
CREATE TABLE IF NOT EXISTS public.simples_brackets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annex text NOT NULL CHECK (annex IN ('I','II','III','IV','V')),
  bracket smallint NOT NULL CHECK (bracket BETWEEN 1 AND 6),
  rbt12_from numeric(14,2) NOT NULL,
  rbt12_to numeric(14,2),
  nominal_rate numeric(7,4) NOT NULL,
  deduction numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (annex, bracket)
);

GRANT SELECT ON public.simples_brackets TO authenticated;
GRANT SELECT ON public.simples_brackets TO anon;
GRANT ALL ON public.simples_brackets TO service_role;
ALTER TABLE public.simples_brackets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "simples_brackets_read" ON public.simples_brackets;
CREATE POLICY "simples_brackets_read" ON public.simples_brackets
  FOR SELECT TO authenticated, anon USING (true);

INSERT INTO public.simples_brackets (annex, bracket, rbt12_from, rbt12_to, nominal_rate, deduction) VALUES
  ('I',1,0,180000,4.00,0),        ('I',2,180000.01,360000,7.30,5940),
  ('I',3,360000.01,720000,9.50,13860), ('I',4,720000.01,1800000,10.70,22500),
  ('I',5,1800000.01,3600000,14.30,87300), ('I',6,3600000.01,4800000,19.00,378000),
  ('II',1,0,180000,4.50,0),       ('II',2,180000.01,360000,7.80,5940),
  ('II',3,360000.01,720000,10.00,13860), ('II',4,720000.01,1800000,11.20,22500),
  ('II',5,1800000.01,3600000,14.70,85500), ('II',6,3600000.01,4800000,30.00,720000),
  ('III',1,0,180000,6.00,0),      ('III',2,180000.01,360000,11.20,9360),
  ('III',3,360000.01,720000,13.50,17640), ('III',4,720000.01,1800000,16.00,35640),
  ('III',5,1800000.01,3600000,21.00,125640), ('III',6,3600000.01,4800000,33.00,648000),
  ('IV',1,0,180000,4.50,0),       ('IV',2,180000.01,360000,9.00,8100),
  ('IV',3,360000.01,720000,10.20,12420), ('IV',4,720000.01,1800000,14.00,39780),
  ('IV',5,1800000.01,3600000,22.00,183780), ('IV',6,3600000.01,4800000,33.00,828000),
  ('V',1,0,180000,15.50,0),       ('V',2,180000.01,360000,18.00,4500),
  ('V',3,360000.01,720000,19.50,9900), ('V',4,720000.01,1800000,20.50,17100),
  ('V',5,1800000.01,3600000,23.00,62100), ('V',6,3600000.01,4800000,30.50,540000)
ON CONFLICT (annex, bracket) DO NOTHING;

-- ---------- PARTE 1: perfil tributário da empresa ----------
CREATE TABLE IF NOT EXISTS public.company_tax_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tax_regime text NOT NULL DEFAULT 'simples_nacional'
    CHECK (tax_regime IN ('simples_nacional','lucro_presumido','lucro_real','mei')),
  simples_annex text CHECK (simples_annex IN ('I','II','III','IV','V')),
  rbt12 numeric(14,2) NOT NULL DEFAULT 0 CHECK (rbt12 >= 0),
  effective_rate numeric(7,4) NOT NULL DEFAULT 0 CHECK (effective_rate >= 0),
  nominal_rate numeric(7,4) NOT NULL DEFAULT 0 CHECK (nominal_rate >= 0),
  icms_regime text NOT NULL DEFAULT 'simples',
  pis_regime text NOT NULL DEFAULT 'simples',
  cofins_regime text NOT NULL DEFAULT 'simples',
  iss_regime text NOT NULL DEFAULT 'nao_aplicavel',
  ipi_regime text NOT NULL DEFAULT 'nao_aplicavel',
  due_day smallint NOT NULL DEFAULT 20 CHECK (due_day BETWEEN 1 AND 28),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_company_tax_profile_active
  ON public.company_tax_profile (company_id) WHERE active;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_tax_profile TO authenticated;
GRANT ALL ON public.company_tax_profile TO service_role;
ALTER TABLE public.company_tax_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tax_profile_select" ON public.company_tax_profile;
CREATE POLICY "tax_profile_select" ON public.company_tax_profile
  FOR SELECT TO authenticated USING (public.user_has_company_access(company_id));
DROP POLICY IF EXISTS "tax_profile_insert" ON public.company_tax_profile;
CREATE POLICY "tax_profile_insert" ON public.company_tax_profile
  FOR INSERT TO authenticated WITH CHECK (public.user_has_company_access(company_id));
DROP POLICY IF EXISTS "tax_profile_update" ON public.company_tax_profile;
CREATE POLICY "tax_profile_update" ON public.company_tax_profile
  FOR UPDATE TO authenticated USING (public.user_has_company_access(company_id))
  WITH CHECK (public.user_has_company_access(company_id));
DROP POLICY IF EXISTS "tax_profile_delete" ON public.company_tax_profile;
CREATE POLICY "tax_profile_delete" ON public.company_tax_profile
  FOR DELETE TO authenticated USING (public.user_has_company_access(company_id));

DROP TRIGGER IF EXISTS trg_company_tax_profile_touch ON public.company_tax_profile;
CREATE TRIGGER trg_company_tax_profile_touch
  BEFORE UPDATE ON public.company_tax_profile
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

-- ---------- PARTE 3: apurações ----------
CREATE TABLE IF NOT EXISTS public.tax_apportionments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  competence date NOT NULL,
  tax_regime text NOT NULL,
  simples_annex text,
  bracket smallint,
  revenue numeric(14,2) NOT NULL DEFAULT 0,
  base_amount numeric(14,2) NOT NULL DEFAULT 0,
  rbt12 numeric(14,2) NOT NULL DEFAULT 0,
  nominal_rate numeric(7,4) NOT NULL DEFAULT 0,
  deduction numeric(14,2) NOT NULL DEFAULT 0,
  effective_rate numeric(7,4) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  due_date date,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','closed','paid','cancelled')),
  entry_id uuid REFERENCES public.accounting_entries(id) ON DELETE SET NULL,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, competence)
);

CREATE INDEX IF NOT EXISTS idx_tax_apportionments_company_comp
  ON public.tax_apportionments (company_id, competence DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_apportionments TO authenticated;
GRANT ALL ON public.tax_apportionments TO service_role;
ALTER TABLE public.tax_apportionments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tax_apportionments_select" ON public.tax_apportionments;
CREATE POLICY "tax_apportionments_select" ON public.tax_apportionments
  FOR SELECT TO authenticated USING (public.user_has_company_access(company_id));
DROP POLICY IF EXISTS "tax_apportionments_insert" ON public.tax_apportionments;
CREATE POLICY "tax_apportionments_insert" ON public.tax_apportionments
  FOR INSERT TO authenticated WITH CHECK (public.user_has_company_access(company_id));
DROP POLICY IF EXISTS "tax_apportionments_update" ON public.tax_apportionments;
CREATE POLICY "tax_apportionments_update" ON public.tax_apportionments
  FOR UPDATE TO authenticated USING (public.user_has_company_access(company_id))
  WITH CHECK (public.user_has_company_access(company_id));
DROP POLICY IF EXISTS "tax_apportionments_delete" ON public.tax_apportionments;
CREATE POLICY "tax_apportionments_delete" ON public.tax_apportionments
  FOR DELETE TO authenticated USING (public.user_has_company_access(company_id));

DROP TRIGGER IF EXISTS trg_tax_apportionments_touch ON public.tax_apportionments;
CREATE TRIGGER trg_tax_apportionments_touch
  BEFORE UPDATE ON public.tax_apportionments
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

-- Apuração fechada/paga é imutável (nunca alterar histórico).
CREATE OR REPLACE FUNCTION public.tax_guard_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('closed','paid') THEN
      RAISE EXCEPTION 'Apuração % já encerrada não pode ser excluída.', OLD.competence;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'paid' AND NEW.status <> 'cancelled' AND (
       NEW.tax_amount IS DISTINCT FROM OLD.tax_amount
    OR NEW.revenue    IS DISTINCT FROM OLD.revenue
    OR NEW.base_amount IS DISTINCT FROM OLD.base_amount
  ) THEN
    RAISE EXCEPTION 'Apuração % já paga não pode ter valores alterados.', OLD.competence;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tax_guard_immutable ON public.tax_apportionments;
CREATE TRIGGER trg_tax_guard_immutable
  BEFORE UPDATE OR DELETE ON public.tax_apportionments
  FOR EACH ROW EXECUTE FUNCTION public.tax_guard_immutable();

-- ---------- PARTE 2: motor do Simples ----------
CREATE OR REPLACE FUNCTION public.simples_compute(
  _annex text,
  _rbt12 numeric,
  _revenue numeric
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  b record;
  _base numeric := GREATEST(COALESCE(_rbt12,0), 0);
  _rev  numeric := GREATEST(COALESCE(_revenue,0), 0);
  _eff  numeric;
BEGIN
  SELECT * INTO b
    FROM public.simples_brackets s
   WHERE s.annex = _annex
     AND _base >= s.rbt12_from
     AND (s.rbt12_to IS NULL OR _base <= s.rbt12_to)
   ORDER BY s.bracket
   LIMIT 1;

  IF NOT FOUND THEN
    -- Acima do limite do Simples: usa a última faixa do anexo.
    SELECT * INTO b FROM public.simples_brackets s
     WHERE s.annex = _annex ORDER BY s.bracket DESC LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Anexo do Simples inválido: %', _annex;
  END IF;

  -- Alíquota efetiva = (RBT12 * nominal - parcela a deduzir) / RBT12.
  -- Sem histórico (RBT12 = 0), aplica-se a alíquota nominal da 1ª faixa.
  IF _base <= 0 THEN
    _eff := b.nominal_rate;
  ELSE
    _eff := ((_base * (b.nominal_rate / 100.0)) - b.deduction) / _base * 100.0;
  END IF;
  _eff := GREATEST(ROUND(_eff, 4), 0);

  RETURN jsonb_build_object(
    'annex', b.annex,
    'bracket', b.bracket,
    'rbt12', ROUND(_base, 2),
    'revenue', ROUND(_rev, 2),
    'nominal_rate', ROUND(b.nominal_rate, 4),
    'deduction', ROUND(b.deduction, 2),
    'effective_rate', _eff,
    'tax_amount', ROUND(_rev * _eff / 100.0, 2),
    'limit_usage_pct', ROUND(_base / 4800000.0 * 100.0, 2)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.simples_compute(text, numeric, numeric) TO authenticated, service_role;

-- Receita bruta de um mês (vendas reais, sem testes e sem canceladas)
CREATE OR REPLACE FUNCTION public.company_monthly_revenue(_company_id uuid, _competence date)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(s.grand_total), 0)::numeric
    FROM public.sales s
   WHERE s.company_id = _company_id
     AND COALESCE(s.is_test, false) = false
     AND s.status <> 'cancelled'
     AND s.sale_date >= date_trunc('month', _competence)::date
     AND s.sale_date <  (date_trunc('month', _competence) + interval '1 month')::date;
$$;

-- RBT12: receita bruta dos 12 meses anteriores à competência
CREATE OR REPLACE FUNCTION public.company_rbt12(_company_id uuid, _competence date)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(s.grand_total), 0)::numeric
    FROM public.sales s
   WHERE s.company_id = _company_id
     AND COALESCE(s.is_test, false) = false
     AND s.status <> 'cancelled'
     AND s.sale_date >= (date_trunc('month', _competence) - interval '12 months')::date
     AND s.sale_date <  date_trunc('month', _competence)::date;
$$;

GRANT EXECUTE ON FUNCTION public.company_monthly_revenue(uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.company_rbt12(uuid, date) TO authenticated, service_role;

-- ---------- PARTES 3 e 4: apuração + integração contábil ----------
CREATE OR REPLACE FUNCTION public.generate_tax_apportionment(
  _company_id uuid,
  _competence date,
  _close boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prof record;
  _comp date := date_trunc('month', _competence)::date;
  _rev numeric;
  _rbt12 numeric;
  _calc jsonb;
  _tax numeric;
  _eff numeric;
  _due date;
  _row public.tax_apportionments;
  _entry uuid;
  _existing public.tax_apportionments;
BEGIN
  IF NOT public.user_has_company_access(_company_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO _prof FROM public.company_tax_profile
   WHERE company_id = _company_id AND active LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil tributário não configurado para esta empresa.';
  END IF;

  SELECT * INTO _existing FROM public.tax_apportionments
   WHERE company_id = _company_id AND competence = _comp;
  IF FOUND AND _existing.status = 'paid' THEN
    RAISE EXCEPTION 'Competência % já paga — apuração imutável.', to_char(_comp,'MM/YYYY');
  END IF;

  _rev   := public.company_monthly_revenue(_company_id, _comp);
  _rbt12 := public.company_rbt12(_company_id, _comp);

  IF _prof.tax_regime = 'simples_nacional' THEN
    IF _prof.simples_annex IS NULL THEN
      RAISE EXCEPTION 'Anexo do Simples Nacional não definido no perfil tributário.';
    END IF;
    _calc := public.simples_compute(_prof.simples_annex, _rbt12, _rev);
    _eff  := (_calc->>'effective_rate')::numeric;
    _tax  := (_calc->>'tax_amount')::numeric;
  ELSE
    -- Lucro Presumido / Lucro Real: alíquota efetiva parametrizada no perfil.
    _eff := COALESCE(_prof.effective_rate, 0);
    _tax := ROUND(_rev * _eff / 100.0, 2);
    _calc := jsonb_build_object(
      'annex', NULL, 'bracket', NULL, 'rbt12', ROUND(_rbt12,2), 'revenue', ROUND(_rev,2),
      'nominal_rate', COALESCE(_prof.nominal_rate,0), 'deduction', 0,
      'effective_rate', _eff, 'tax_amount', _tax
    );
  END IF;

  _due := (date_trunc('month', _comp) + interval '1 month')::date
          + (COALESCE(_prof.due_day, 20) - 1);

  -- Estorna lançamentos anteriores desta competência (nunca altera histórico).
  PERFORM public.accounting_reverse_origin(
    _company_id, 'tax_apportionment', COALESCE(_existing.id, '00000000-0000-0000-0000-000000000000'::uuid),
    'Reapuração de tributos ' || to_char(_comp, 'MM/YYYY')
  );

  INSERT INTO public.tax_apportionments AS t (
    company_id, competence, tax_regime, simples_annex, bracket, revenue, base_amount,
    rbt12, nominal_rate, deduction, effective_rate, tax_amount, due_date, status,
    breakdown, created_by
  ) VALUES (
    _company_id, _comp, _prof.tax_regime, _prof.simples_annex,
    NULLIF(_calc->>'bracket','')::smallint, _rev, _rev, _rbt12,
    COALESCE((_calc->>'nominal_rate')::numeric, 0),
    COALESCE((_calc->>'deduction')::numeric, 0),
    _eff, _tax, _due, CASE WHEN _close THEN 'closed' ELSE 'open' END,
    _calc, auth.uid()
  )
  ON CONFLICT (company_id, competence) DO UPDATE SET
    tax_regime = EXCLUDED.tax_regime,
    simples_annex = EXCLUDED.simples_annex,
    bracket = EXCLUDED.bracket,
    revenue = EXCLUDED.revenue,
    base_amount = EXCLUDED.base_amount,
    rbt12 = EXCLUDED.rbt12,
    nominal_rate = EXCLUDED.nominal_rate,
    deduction = EXCLUDED.deduction,
    effective_rate = EXCLUDED.effective_rate,
    tax_amount = EXCLUDED.tax_amount,
    due_date = EXCLUDED.due_date,
    status = CASE WHEN _close THEN 'closed' ELSE t.status END,
    breakdown = EXCLUDED.breakdown
  RETURNING * INTO _row;

  -- Lançamento contábil: D Impostos sobre Vendas / C Impostos a Recolher
  IF _row.tax_amount > 0 THEN
    _entry := public.accounting_post_entry(
      _company_id,
      LEAST(_due, (date_trunc('month', _comp) + interval '1 month - 1 day')::date),
      'Tributos sobre vendas ' || to_char(_comp, 'MM/YYYY'),
      'tax_apportionment', _row.id, 'apportionment',
      'APUR-' || to_char(_comp, 'YYYYMM'),
      jsonb_build_array(
        jsonb_build_object('code','4.2.03','side','debit','amount', _row.tax_amount,
                           'memo','Impostos sobre vendas'),
        jsonb_build_object('code','2.1.03','side','credit','amount', _row.tax_amount,
                           'memo','Impostos a recolher')
      )
    );
    UPDATE public.tax_apportionments SET entry_id = _entry WHERE id = _row.id;
  END IF;

  -- Mantém o perfil sincronizado com a última apuração.
  UPDATE public.company_tax_profile
     SET rbt12 = _rbt12,
         effective_rate = _eff,
         nominal_rate = COALESCE((_calc->>'nominal_rate')::numeric, nominal_rate)
   WHERE id = _prof.id;

  RETURN jsonb_build_object(
    'id', _row.id,
    'competence', _comp,
    'tax_regime', _row.tax_regime,
    'annex', _row.simples_annex,
    'bracket', _row.bracket,
    'revenue', _row.revenue,
    'rbt12', _row.rbt12,
    'nominal_rate', _row.nominal_rate,
    'deduction', _row.deduction,
    'effective_rate', _row.effective_rate,
    'tax_amount', _row.tax_amount,
    'due_date', _row.due_date,
    'status', CASE WHEN _close THEN 'closed' ELSE _row.status END,
    'entry_id', _entry,
    'breakdown', _row.breakdown
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_tax_apportionment(uuid, date, boolean) TO authenticated, service_role;

-- ---------- PARTE 7: projeções ----------
CREATE OR REPLACE FUNCTION public.project_tax_scenarios(
  _company_id uuid,
  _competence date,
  _growth numeric[] DEFAULT ARRAY[0,10,20,30]
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prof record;
  _comp date := date_trunc('month', _competence)::date;
  _rev numeric;
  _rbt12 numeric;
  _g numeric;
  _calc jsonb;
  _scen jsonb := '[]'::jsonb;
  _dre jsonb;
  _cogs_ratio numeric := 0;
  _opex numeric := 0;
  _proj_rev numeric;
  _proj_tax numeric;
  _profit numeric;
BEGIN
  IF NOT public.user_has_company_access(_company_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO _prof FROM public.company_tax_profile
   WHERE company_id = _company_id AND active LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil tributário não configurado.'; END IF;

  _rev   := public.company_monthly_revenue(_company_id, _comp);
  _rbt12 := public.company_rbt12(_company_id, _comp);

  _dre := public.generate_dre(
    _company_id,
    _comp,
    (date_trunc('month', _comp) + interval '1 month - 1 day')::date
  );
  IF COALESCE((_dre->>'gross_revenue')::numeric, 0) > 0 THEN
    _cogs_ratio := (_dre->>'cogs')::numeric / (_dre->>'gross_revenue')::numeric;
  END IF;
  _opex := COALESCE((_dre->>'operating_expenses')::numeric, 0);

  FOREACH _g IN ARRAY _growth LOOP
    _proj_rev := ROUND(_rev * (1 + _g / 100.0), 2);
    IF _prof.tax_regime = 'simples_nacional' AND _prof.simples_annex IS NOT NULL THEN
      _calc := public.simples_compute(
        _prof.simples_annex,
        ROUND(_rbt12 * (1 + _g / 100.0), 2),
        _proj_rev
      );
      _proj_tax := (_calc->>'tax_amount')::numeric;
    ELSE
      _calc := jsonb_build_object('effective_rate', COALESCE(_prof.effective_rate,0));
      _proj_tax := ROUND(_proj_rev * COALESCE(_prof.effective_rate,0) / 100.0, 2);
    END IF;

    _profit := ROUND(_proj_rev - (_proj_rev * _cogs_ratio) - _opex - _proj_tax, 2);

    _scen := _scen || jsonb_build_object(
      'growth_pct', _g,
      'revenue', _proj_rev,
      'tax_amount', _proj_tax,
      'effective_rate', (_calc->>'effective_rate')::numeric,
      'bracket', NULLIF(_calc->>'bracket','')::smallint,
      'cogs', ROUND(_proj_rev * _cogs_ratio, 2),
      'operating_expenses', ROUND(_opex, 2),
      'net_profit', _profit,
      'net_margin', CASE WHEN _proj_rev > 0 THEN ROUND(_profit / _proj_rev * 100, 2) ELSE 0 END
    );
  END LOOP;

  RETURN jsonb_build_object(
    'competence', _comp,
    'base_revenue', ROUND(_rev, 2),
    'rbt12', ROUND(_rbt12, 2),
    'scenarios', _scen
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.project_tax_scenarios(uuid, date, numeric[]) TO authenticated, service_role;

-- ---------- PARTE 5: DRE com tributos segregados ----------
CREATE OR REPLACE FUNCTION public.generate_dre(_company_id uuid, _start date, _end date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rev numeric := 0; _ded numeric := 0; _cmv numeric := 0; _opex numeric := 0;
  _fin numeric := 0; _other_rev numeric := 0; _other_exp numeric := 0; _depr numeric := 0;
  _sales_taxes numeric := 0; _other_ded numeric := 0;
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
    COALESCE(SUM(b.balance) FILTER (WHERE b.type='OUTRAS_DESPESAS'),0),
    COALESCE(SUM(b.balance) FILTER (WHERE b.code = '4.2.03'),0)
  INTO _rev, _ded, _cmv, _opex, _fin, _other_rev, _other_exp, _sales_taxes
  FROM public.accounting_balances(_company_id, _start, _end) b;

  SELECT COALESCE(SUM(b.balance),0) INTO _depr
    FROM public.accounting_balances(_company_id, _start, _end) b
    JOIN public.accounting_accounts a ON a.id = b.account_id
   WHERE a.is_depreciation;

  _other_ded := _ded - _sales_taxes;
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
    'sales_taxes', ROUND(_sales_taxes,2),
    'other_deductions', ROUND(_other_ded,2),
    'taxes', ROUND(_sales_taxes,2),
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
    'tax_burden', CASE WHEN _rev > 0 THEN ROUND(_sales_taxes/_rev*100,2) ELSE 0 END,
    'gross_margin', CASE WHEN _net_rev > 0 THEN ROUND(_gross/_net_rev*100,2) ELSE 0 END,
    'operating_margin', CASE WHEN _net_rev > 0 THEN ROUND(_op/_net_rev*100,2) ELSE 0 END,
    'net_margin', CASE WHEN _net_rev > 0 THEN ROUND(_net/_net_rev*100,2) ELSE 0 END,
    'ebitda_margin', CASE WHEN _net_rev > 0 THEN ROUND(_ebitda/_net_rev*100,2) ELSE 0 END,
    'lines', _lines
  );
END;
$$;