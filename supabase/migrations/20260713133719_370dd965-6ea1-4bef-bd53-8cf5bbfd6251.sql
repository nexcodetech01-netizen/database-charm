
-- =========================
-- FINANCIAL ACCOUNTS
-- =========================
CREATE TABLE public.financial_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'bank' CHECK (type IN ('bank','cash','digital_wallet')),
  bank TEXT,
  agency TEXT,
  account_number TEXT,
  initial_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  color TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_accounts TO authenticated;
GRANT ALL ON public.financial_accounts TO service_role;

ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage financial accounts"
ON public.financial_accounts FOR ALL
USING (public.user_owns_company(company_id))
WITH CHECK (public.user_owns_company(company_id));

CREATE INDEX idx_financial_accounts_company ON public.financial_accounts(company_id);

CREATE TRIGGER update_financial_accounts_updated_at
BEFORE UPDATE ON public.financial_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- FINANCIAL CATEGORIES
-- =========================
CREATE TABLE public.financial_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('income','expense')),
  parent_id UUID REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  color TEXT,
  icon TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_categories TO authenticated;
GRANT ALL ON public.financial_categories TO service_role;

ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage financial categories"
ON public.financial_categories FOR ALL
USING (public.user_owns_company(company_id))
WITH CHECK (public.user_owns_company(company_id));

CREATE INDEX idx_financial_categories_company ON public.financial_categories(company_id);
CREATE INDEX idx_financial_categories_parent ON public.financial_categories(parent_id);

CREATE TRIGGER update_financial_categories_updated_at
BEFORE UPDATE ON public.financial_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- COST CENTERS
-- =========================
CREATE TABLE public.cost_centers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_centers TO authenticated;
GRANT ALL ON public.cost_centers TO service_role;

ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage cost centers"
ON public.cost_centers FOR ALL
USING (public.user_owns_company(company_id))
WITH CHECK (public.user_owns_company(company_id));

CREATE INDEX idx_cost_centers_company ON public.cost_centers(company_id);

CREATE TRIGGER update_cost_centers_updated_at
BEFORE UPDATE ON public.cost_centers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- FINANCIAL TRANSACTIONS
-- =========================
CREATE TABLE public.financial_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  transfer_to_account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('income','expense','transfer')),
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue','cancelled')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','sale','purchase','bella_pay','transfer')),
  reference_id UUID,
  reference_number TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_transactions TO authenticated;
GRANT ALL ON public.financial_transactions TO service_role;

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage financial transactions"
ON public.financial_transactions FOR ALL
USING (public.user_owns_company(company_id))
WITH CHECK (public.user_owns_company(company_id));

CREATE INDEX idx_financial_transactions_company ON public.financial_transactions(company_id);
CREATE INDEX idx_financial_transactions_account ON public.financial_transactions(account_id);
CREATE INDEX idx_financial_transactions_category ON public.financial_transactions(category_id);
CREATE INDEX idx_financial_transactions_status ON public.financial_transactions(status);
CREATE INDEX idx_financial_transactions_date ON public.financial_transactions(transaction_date);
CREATE INDEX idx_financial_transactions_due ON public.financial_transactions(due_date);
CREATE INDEX idx_financial_transactions_reference ON public.financial_transactions(source, reference_id);

CREATE TRIGGER update_financial_transactions_updated_at
BEFORE UPDATE ON public.financial_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
