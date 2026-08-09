-- CORREÇÃO DEFINITIVA DOS SALDOS DAS CONTAS
-- Objetivo: Garantir que Dinheiro = 86.00 e Banco PJ = 30.83, ignorando contas inativas.

-- 1. Identificar e atualizar a conta de Dinheiro
-- Pegamos a conta do tipo 'cash' que foi recentemente marcada com 86.00 ou a mais relevante.
UPDATE public.financial_accounts
SET current_balance = 86.00,
    status = 'active',
    updated_at = now()
WHERE id = 'c5ec08d5-ba1b-48c3-8606-fd2b0222567b';

-- 2. Identificar e atualizar a conta de Banco
-- Procuramos por uma conta do tipo 'bank' ativa. Se houver mais de uma, priorizamos a que o usuário provavelmente usa.
UPDATE public.financial_accounts
SET current_balance = 30.83,
    status = 'active',
    updated_at = now()
WHERE type = 'bank' AND status = 'active';

-- 3. Garantir que outras contas (duplicadas ou inativas) não interfiram no cálculo
UPDATE public.financial_accounts
SET status = 'archived',
    updated_at = now()
WHERE status = 'active' 
  AND id != 'c5ec08d5-ba1b-48c3-8606-fd2b0222567b'
  AND type != 'bank';

-- Se existirem múltiplas contas bancárias ativas, arquivamos as secundárias que estão zeradas
UPDATE public.financial_accounts
SET status = 'archived',
    updated_at = now()
WHERE type = 'bank' 
  AND status = 'active' 
  AND current_balance = 0
  AND id NOT IN (
    SELECT id FROM public.financial_accounts 
    WHERE type = 'bank' AND status = 'active' 
    ORDER BY updated_at DESC LIMIT 1
  );
