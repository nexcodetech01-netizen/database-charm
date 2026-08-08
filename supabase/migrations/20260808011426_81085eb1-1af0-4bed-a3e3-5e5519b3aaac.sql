-- NEXOS ENTERPRISE: Saneamento de Status de Vendas (Partially Paid)

-- 1) Saneamento: Bianca Mariano (PDV-20260807-212745)
-- Total 189.99, Pago 95.00, Saldo 94.99
DO $$
DECLARE
    v_sale_id uuid;
BEGIN
    SELECT id INTO v_sale_id FROM public.sales WHERE number = 'PDV-20260807-212745';
    
    IF v_sale_id IS NOT NULL THEN
        UPDATE public.sales SET status = 'partially_paid' WHERE id = v_sale_id;
        
        -- Ajusta transação financeira se existir (pode estar como paid ou pending)
        UPDATE public.financial_transactions 
        SET status = 'pending', amount = 189.99 
        WHERE source = 'sale' AND reference_id = v_sale_id;
        
        -- Se houver crediário, garante o saldo
        UPDATE public.credit_accounts 
        SET balance = 94.99 
        WHERE sale_id = v_sale_id;
    END IF;
END $$;

-- 2) Saneamento: Aurea Queiroz da Fonseca (PDV-20260807-213427)
-- Total 146.00, Pago 73.00, Saldo 73.00
DO $$
DECLARE
    v_sale_id uuid;
BEGIN
    SELECT id INTO v_sale_id FROM public.sales WHERE number = 'PDV-20260807-213427';
    
    IF v_sale_id IS NOT NULL THEN
        UPDATE public.sales SET status = 'partially_paid' WHERE id = v_sale_id;
        
        UPDATE public.financial_transactions 
        SET status = 'pending', amount = 146.00 
        WHERE source = 'sale' AND reference_id = v_sale_id;
        
        UPDATE public.credit_accounts 
        SET balance = 73.00 
        WHERE sale_id = v_sale_id;
    END IF;
END $$;
