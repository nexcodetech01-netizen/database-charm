-- HOTFIX-002: isolar apuração do caixa por sessão.
-- Adiciona vínculo direto entre a venda e a sessão de caixa que a originou.

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS cash_session_id UUID
  REFERENCES public.cash_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_cash_session_id
  ON public.sales(cash_session_id)
  WHERE cash_session_id IS NOT NULL;

COMMENT ON COLUMN public.sales.cash_session_id IS
  'HOTFIX-002: sessão de caixa que originou a venda. Base única para a apuração do fechamento (computeSummary). Nulo em vendas legadas ou criadas fora do PDV.';