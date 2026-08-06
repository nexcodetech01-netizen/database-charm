-- NEXOS ERP - Script de Saneamento de Dados (Tabela 'products')
-- Este script atualiza registros antigos com campos obrigatórios ausentes.

DO $$ 
DECLARE 
    updated_count integer;
BEGIN
    -- 1. Atualização em massa de campos obrigatórios ausentes
    UPDATE public.products
    SET 
        -- Gera SKU sequencial apenas se estiver nulo ou vazio
        sku = CASE 
            WHEN sku IS NULL OR trim(sku) = '' THEN 'PRD-' || LPAD(id::text, 5, '0')
            ELSE sku 
        END,
        -- Define unidade padrão 'UN'
        unit = CASE 
            WHEN unit IS NULL OR trim(unit) = '' THEN 'UN'
            ELSE unit 
        END,
        -- Define peso padrão 0.3kg
        weight = CASE 
            WHEN weight IS NULL OR weight = 0 THEN 0.3
            ELSE weight 
        END,
        -- Define dimensões padrão 15x15x15cm
        length = CASE 
            WHEN length IS NULL OR length = 0 THEN 15
            ELSE length 
        END,
        width = CASE 
            WHEN width IS NULL OR width = 0 THEN 15
            ELSE width 
        END,
        height = CASE 
            WHEN height IS NULL OR height = 0 THEN 15
            ELSE height 
        END,
        -- Define 'SEM GTIN' se barcode estiver vazio
        barcode = CASE 
            WHEN barcode IS NULL OR trim(barcode) = '' THEN 'SEM GTIN'
            ELSE barcode 
        END
    WHERE 
        sku IS NULL OR trim(sku) = '' OR
        unit IS NULL OR trim(unit) = '' OR
        weight IS NULL OR weight = 0 OR
        barcode IS NULL OR trim(barcode) = '';

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    -- O retorno será processado pelo Supabase
END $$;