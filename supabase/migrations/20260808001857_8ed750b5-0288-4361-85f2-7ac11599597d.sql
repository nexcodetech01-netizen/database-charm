
-- CORREÇÃO DE STATUS DE VENDA NO CREDIÁRIO SEM ENTRADA
-- 1. Garante que vendas no Crediário com entrada 0.00 sejam 'pending'
-- 2. Atualiza registros legados (incluindo o mencionado PDV-20260807-210312)

BEGIN;

-- Saneamento de registros legados
-- Identifica vendas onde:
-- a) payment_method é 'credit'
-- b) status é 'partially_paid'
-- c) não houve entrada (conforme a tabela credit_accounts ou financial_transactions)
UPDATE public.sales s
SET status = 'pending'
WHERE s.payment_method = 'credit'
  AND s.status = 'partially_paid'
  AND EXISTS (
    SELECT 1 
    from public.credit_accounts ca 
    where ca.sale_id = s.id 
      and ca.down_payment = 0
  );

-- Caso existam vendas sem registro em credit_accounts mas identificadas pelo usuário pelo padrão de número
UPDATE public.sales s
SET status = 'pending'
WHERE s.number = 'PDV-20260807-210312'
  AND s.status = 'partially_paid';

COMMIT;
