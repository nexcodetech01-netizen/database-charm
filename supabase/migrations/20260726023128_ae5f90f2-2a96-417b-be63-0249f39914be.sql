ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS settlement_session_id uuid NULL REFERENCES public.cash_sessions(id);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_settlement_session
  ON public.financial_transactions(settlement_session_id)
  WHERE settlement_session_id IS NOT NULL;

COMMENT ON COLUMN public.financial_transactions.settlement_session_id IS
  'Sessao de caixa a que a liquidacao pertence para fins de fechamento. Usada apenas para regularizar baixas historicas feitas fora de sessao.';

-- Regularizacao das liquidacoes historicas fora de sessao
UPDATE public.financial_transactions ft
SET settlement_session_id = 'c0476428-e9f9-46f0-a833-ae35429da813'::uuid
FROM public.sales s
WHERE s.id = ft.reference_id
  AND ft.source = 'sale'
  AND ft.type = 'income'
  AND ft.status = 'paid'
  AND ft.settlement_session_id IS NULL
  AND s.number IN ('VD-20260718-1823','VD-20260721-2038','VD-20260721-2039','VD-20260721-2042');