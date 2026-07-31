
-- =========================================================
-- MOTOR CONTÁBIL — PARTE 1/2: plano de contas e lançamentos
-- =========================================================

CREATE TABLE IF NOT EXISTS public.accounting_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN (
    'ATIVO','PASSIVO','PATRIMONIO_LIQUIDO','RECEITA','DEDUCOES','CMV',
    'DESPESA_OPERACIONAL','DESPESA_FINANCEIRA','OUTRAS_RECEITAS','OUTRAS_DESPESAS'
  )),
  nature text NOT NULL CHECK (nature IN ('debit','credit')),
  parent_id uuid REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT,
  accepts_posting boolean NOT NULL DEFAULT true,
  is_depreciation boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

GRANT SELECT ON public.accounting_accounts TO authenticated;
GRANT ALL ON public.accounting_accounts TO service_role;
ALTER TABLE public.accounting_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounting_accounts_select" ON public.accounting_accounts
  FOR SELECT TO authenticated USING (public.user_has_company_access(company_id));

CREATE INDEX IF NOT EXISTS idx_accounting_accounts_company_type
  ON public.accounting_accounts(company_id, type);

CREATE TRIGGER trg_accounting_accounts_touch
  BEFORE UPDATE ON public.accounting_accounts
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

-- ---------------------------------------------------------
-- Lançamentos contábeis (partidas dobradas)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  origin text NOT NULL,
  origin_id uuid,
  origin_event text NOT NULL DEFAULT 'default',
  document text,
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','reversed')),
  reversal_of uuid REFERENCES public.accounting_entries(id) ON DELETE RESTRICT,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  hash text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.accounting_entries TO authenticated;
GRANT ALL ON public.accounting_entries TO service_role;
ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounting_entries_select" ON public.accounting_entries
  FOR SELECT TO authenticated USING (public.user_has_company_access(company_id));

CREATE UNIQUE INDEX IF NOT EXISTS uq_accounting_entries_origin
  ON public.accounting_entries(company_id, origin, origin_id, origin_event)
  WHERE origin_id IS NOT NULL AND reversal_of IS NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_entries_company_date
  ON public.accounting_entries(company_id, entry_date);

CREATE TABLE IF NOT EXISTS public.accounting_entry_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.accounting_entries(id) ON DELETE RESTRICT,
  company_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT,
  side text NOT NULL CHECK (side IN ('debit','credit')),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  memo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.accounting_entry_items TO authenticated;
GRANT ALL ON public.accounting_entry_items TO service_role;
ALTER TABLE public.accounting_entry_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounting_entry_items_select" ON public.accounting_entry_items
  FOR SELECT TO authenticated USING (public.user_has_company_access(company_id));

CREATE INDEX IF NOT EXISTS idx_accounting_entry_items_entry ON public.accounting_entry_items(entry_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entry_items_account ON public.accounting_entry_items(company_id, account_id);

-- Imutabilidade: lançamentos contabilizados nunca podem ser editados/apagados.
CREATE OR REPLACE FUNCTION public.accounting_guard_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('nexos.accounting_posting', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'Lançamentos contábeis são imutáveis. Utilize estorno.';
END;
$$;

CREATE TRIGGER trg_accounting_entries_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON public.accounting_entries
  FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_immutable();

CREATE TRIGGER trg_accounting_entry_items_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON public.accounting_entry_items
  FOR EACH ROW EXECUTE FUNCTION public.accounting_guard_immutable();

-- ---------------------------------------------------------
-- Plano de contas padrão
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_seed_chart(_company_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  _created integer := 0;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('1',       'Ativo',                        'ATIVO','debit',  false,false),
      ('1.1',     'Ativo Circulante',             'ATIVO','debit',  false,false),
      ('1.1.01',  'Caixa',                        'ATIVO','debit',  true, false),
      ('1.1.02',  'Bancos',                       'ATIVO','debit',  true, false),
      ('1.1.03',  'Contas a Receber',             'ATIVO','debit',  true, false),
      ('1.1.04',  'Estoques',                     'ATIVO','debit',  true, false),
      ('1.2',     'Ativo Não Circulante',         'ATIVO','debit',  false,false),
      ('1.2.01',  'Imobilizado',                  'ATIVO','debit',  true, false),
      ('2',       'Passivo',                      'PASSIVO','credit',false,false),
      ('2.1',     'Passivo Circulante',           'PASSIVO','credit',false,false),
      ('2.1.01',  'Fornecedores',                 'PASSIVO','credit',true, false),
      ('2.1.02',  'Contas a Pagar',               'PASSIVO','credit',true, false),
      ('2.1.03',  'Impostos a Recolher',          'PASSIVO','credit',true, false),
      ('2.2',     'Passivo Não Circulante',       'PASSIVO','credit',false,false),
      ('2.2.01',  'Empréstimos de Longo Prazo',   'PASSIVO','credit',true, false),
      ('3',       'Patrimônio Líquido',           'PATRIMONIO_LIQUIDO','credit',false,false),
      ('3.1',     'Capital Social',               'PATRIMONIO_LIQUIDO','credit',true, false),
      ('3.2',     'Lucros Acumulados',            'PATRIMONIO_LIQUIDO','credit',true, false),
      ('4',       'Receita Bruta',                'RECEITA','credit',false,false),
      ('4.1.01',  'Receita de Vendas',            'RECEITA','credit',true, false),
      ('4.1.02',  'Receita de Serviços',          'RECEITA','credit',true, false),
      ('4.2',     'Deduções da Receita',          'DEDUCOES','debit',false,false),
      ('4.2.01',  'Descontos Concedidos',         'DEDUCOES','debit', true, false),
      ('4.2.02',  'Devoluções de Vendas',         'DEDUCOES','debit', true, false),
      ('4.2.03',  'Impostos sobre Vendas',        'DEDUCOES','debit', true, false),
      ('5',       'Custo das Mercadorias Vendidas','CMV','debit',    false,false),
      ('5.1.01',  'CMV',                          'CMV','debit',     true, false),
      ('6',       'Despesas Operacionais',        'DESPESA_OPERACIONAL','debit',false,false),
      ('6.1.01',  'Despesas Administrativas',     'DESPESA_OPERACIONAL','debit',true, false),
      ('6.1.02',  'Despesas com Pessoal',         'DESPESA_OPERACIONAL','debit',true, false),
      ('6.1.03',  'Pró-labore',                   'DESPESA_OPERACIONAL','debit',true, false),
      ('6.1.04',  'Despesas Comerciais',          'DESPESA_OPERACIONAL','debit',true, false),
      ('6.1.05',  'Depreciação e Amortização',    'DESPESA_OPERACIONAL','debit',true, true),
      ('6.1.99',  'Outras Despesas Operacionais', 'DESPESA_OPERACIONAL','debit',true, false),
      ('7',       'Despesas Financeiras',         'DESPESA_FINANCEIRA','debit',false,false),
      ('7.1.01',  'Juros e Encargos',             'DESPESA_FINANCEIRA','debit',true, false),
      ('7.1.02',  'Taxas de Meios de Pagamento',  'DESPESA_FINANCEIRA','debit',true, false),
      ('8',       'Outras Receitas',              'OUTRAS_RECEITAS','credit',false,false),
      ('8.1.01',  'Receitas Financeiras',         'OUTRAS_RECEITAS','credit',true, false),
      ('8.1.02',  'Outras Receitas',              'OUTRAS_RECEITAS','credit',true, false),
      ('9',       'Outras Despesas',              'OUTRAS_DESPESAS','debit',false,false),
      ('9.1.01',  'Outras Despesas',              'OUTRAS_DESPESAS','debit',true, false)
    ) AS t(code,name,type,nature,accepts_posting,is_depreciation)
    ORDER BY 1
  LOOP
    INSERT INTO public.accounting_accounts (company_id, code, name, type, nature, accepts_posting, is_depreciation, parent_id)
    VALUES (
      _company_id, r.code, r.name, r.type, r.nature, r.accepts_posting, r.is_depreciation,
      (SELECT a.id FROM public.accounting_accounts a
        WHERE a.company_id = _company_id
          AND r.code LIKE a.code || '.%'
        ORDER BY length(a.code) DESC LIMIT 1)
    )
    ON CONFLICT (company_id, code) DO NOTHING;
    IF FOUND THEN _created := _created + 1; END IF;
  END LOOP;
  RETURN _created;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accounting_seed_chart(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.accounting_account_id(_company_id uuid, _code text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  SELECT id INTO _id FROM public.accounting_accounts
   WHERE company_id = _company_id AND code = _code;
  RETURN _id;
END;
$$;

-- Seed automático para novas empresas
CREATE OR REPLACE FUNCTION public.accounting_seed_new_company()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.accounting_seed_chart(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_companies_seed_chart
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.accounting_seed_new_company();

-- Seed para empresas existentes
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT id FROM public.companies LOOP
    PERFORM public.accounting_seed_chart(c.id);
  END LOOP;
END $$;

-- ---------------------------------------------------------
-- PARTE 3 — Classificação financeira
-- ---------------------------------------------------------
ALTER TABLE public.financial_categories
  ADD COLUMN IF NOT EXISTS accounting_account_id uuid REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT;

UPDATE public.financial_categories fc
   SET accounting_account_id = public.accounting_account_id(
         fc.company_id,
         CASE WHEN fc.kind = 'income' THEN '4.1.01' ELSE '6.1.99' END)
 WHERE fc.accounting_account_id IS NULL;

CREATE OR REPLACE FUNCTION public.financial_categories_default_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.accounting_account_id IS NULL THEN
    NEW.accounting_account_id := public.accounting_account_id(
      NEW.company_id,
      CASE WHEN NEW.kind = 'income' THEN '4.1.01' ELSE '6.1.99' END);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_financial_categories_default_account
  BEFORE INSERT OR UPDATE ON public.financial_categories
  FOR EACH ROW EXECUTE FUNCTION public.financial_categories_default_account();
