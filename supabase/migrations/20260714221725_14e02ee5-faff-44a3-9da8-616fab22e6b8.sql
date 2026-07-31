
-- Cash sessions (PDV-002 - Fechamento de Caixa)
CREATE TABLE public.cash_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  operator_name TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (opening_balance >= 0),
  opening_note TEXT,
  -- Closing snapshot
  counted_cash NUMERIC(14,2),
  expected_cash NUMERIC(14,2),
  difference NUMERIC(14,2),
  closing_note TEXT,
  sales_count INTEGER,
  sales_total NUMERIC(14,2),
  cash_in_total NUMERIC(14,2),
  cash_out_total NUMERIC(14,2),
  by_method JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one open session per operator per company
CREATE UNIQUE INDEX cash_sessions_one_open_per_operator
  ON public.cash_sessions (company_id, operator_id)
  WHERE status = 'open';

CREATE INDEX cash_sessions_company_status_idx
  ON public.cash_sessions (company_id, status, opened_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_sessions TO authenticated;
GRANT ALL ON public.cash_sessions TO service_role;

ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_sessions_company_members"
  ON public.cash_sessions
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE TRIGGER update_cash_sessions_updated_at
  BEFORE UPDATE ON public.cash_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cash movements (suprimentos / sangrias)
CREATE TABLE public.cash_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('cash_in','cash_out')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX cash_movements_session_idx
  ON public.cash_movements (session_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_movements TO authenticated;
GRANT ALL ON public.cash_movements TO service_role;

ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_movements_company_members"
  ON public.cash_movements
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );
