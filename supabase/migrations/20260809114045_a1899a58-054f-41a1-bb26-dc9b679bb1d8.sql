-- CORREÇÃO DA SOMA DE CONTAS ATIVAS
-- 1. Garantir que o Banco PJ está ativo (caso tenha sido arquivado indevidamente)
UPDATE public.financial_accounts
SET status = 'active',
    updated_at = now()
WHERE type IN ('bank', 'digital_wallet') 
  AND name ILIKE '%Banco PJ%';

-- 2. Garantir que o Caixa Principal está ativo
UPDATE public.financial_accounts
SET status = 'active',
    updated_at = now()
WHERE id = 'c5ec08d5-ba1b-48c3-8606-fd2b0222567b';

-- 3. Recalcular current_balance para consistência (Opcional mas recomendado para este fix)
WITH account_sums AS (
  SELECT 
    account_id,
    SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as total_tx
  FROM public.financial_transactions
  WHERE status = 'paid'
  GROUP BY account_id
)
UPDATE public.financial_accounts fa
SET current_balance = fa.initial_balance + COALESCE(s.total_tx, 0),
    updated_at = now()
FROM account_sums s
WHERE fa.id = s.account_id AND fa.status = 'active';
