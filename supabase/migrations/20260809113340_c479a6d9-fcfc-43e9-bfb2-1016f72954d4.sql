-- CORREÇÃO DE SALDO ACUMULADO E RECALCULO DE CONTAS FINANCEIRAS
-- Objetivo: Sincronizar os saldos das contas (Dinheiro e Banco) com a realidade operacional.
-- Fórmula: Saldo = (Saldo Inicial) + (Entradas/Recebimentos) - (Saídas/Despesas/Sangrias)

-- 1. Sincronização inicial: Ajustar os saldos iniciais solicitados pelo usuário
-- Dinheiro: R$ 86,00 | Banco: R$ 30,83

UPDATE public.financial_accounts
SET initial_balance = 86.00,
    updated_at = now()
WHERE type = 'cash' AND status = 'active' AND id = 'c5ec08d5-ba1b-48c3-8606-fd2b0222567b';

-- Arquivar duplicatas de Caixa Principal que estão zeradas
UPDATE public.financial_accounts
SET status = 'archived',
    updated_at = now()
WHERE type = 'cash' AND status = 'active' AND id != 'c5ec08d5-ba1b-48c3-8606-fd2b0222567b';

-- Ajuste para Banco
UPDATE public.financial_accounts
SET initial_balance = 30.83,
    updated_at = now()
WHERE type IN ('bank', 'digital_wallet') AND status = 'active';

-- Se não houver conta bancária, criamos uma
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.financial_accounts WHERE type IN ('bank', 'digital_wallet') AND status = 'active') THEN
        INSERT INTO public.financial_accounts (company_id, name, type, initial_balance, current_balance, status)
        SELECT id, 'Conta Bancária (Empresa)', 'bank', 30.83, 30.83, 'active'
        FROM public.companies
        LIMIT 1;
    END IF;
END $$;

-- 2. Recalcular o current_balance de todas as contas ativas
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

UPDATE public.financial_accounts
SET current_balance = initial_balance,
    updated_at = now()
WHERE status = 'active' 
  AND id NOT IN (SELECT account_id FROM public.financial_transactions WHERE status = 'paid' AND account_id IS NOT NULL);

-- 3. Grant de permissões
GRANT ALL ON public.financial_accounts TO authenticated;
GRANT ALL ON public.financial_accounts TO service_role;
