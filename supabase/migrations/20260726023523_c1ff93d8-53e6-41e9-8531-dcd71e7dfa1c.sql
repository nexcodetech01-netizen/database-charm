ALTER TABLE public.financial_transactions
  DROP CONSTRAINT IF EXISTS financial_transactions_settlement_session_id_fkey;

ALTER TABLE public.financial_transactions
  ADD CONSTRAINT financial_transactions_settlement_session_id_fkey
  FOREIGN KEY (settlement_session_id) REFERENCES public.cash_sessions(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Índice parcial por sessão regularizada já existe como
-- idx_financial_transactions_settlement_session (equivalente ao
-- idx_ft_settlement_session solicitado) — não recriar para evitar redundância.

CREATE INDEX IF NOT EXISTS idx_ft_paid_window
  ON public.financial_transactions (company_id, status, type, paid_at);

ANALYZE public.financial_transactions;