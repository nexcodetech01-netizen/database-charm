CREATE OR REPLACE FUNCTION public.process_kit_stock_decrement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    component_record RECORD;
    v_product_type public.product_type;
BEGIN
    -- Verifica o tipo do produto vendido
    SELECT product_type INTO v_product_type FROM public.products WHERE id = NEW.product_id;
    
    IF v_product_type = 'kit' THEN
        -- Se for kit, percorre os componentes e decrementa o estoque de cada um
        -- Isso dispara as movimentações de estoque necessárias
        FOR component_record IN 
            SELECT component_id, quantity 
            FROM public.product_kit_components 
            WHERE parent_id = NEW.product_id
        LOOP
            -- Registra a movimentação de saída para o componente
            INSERT INTO public.inventory_movements (
                company_id,
                product_id,
                quantity,
                type,
                source,
                reason,
                movement_date
            )
            SELECT 
                p.company_id,
                component_record.component_id,
                (NEW.quantity * component_record.quantity),
                'out',
                'sale_kit_explosion',
                'Baixa automática por venda de Kit (Venda #' || NEW.sale_id || ')',
                now()
            FROM public.products p
            WHERE p.id = component_record.component_id;
        END LOOP;
    ELSE
        -- Se for produto simples, a trigger normal de inventory_movements já deve lidar com isso 
        -- via fluxo padrão do ERP se a venda for configurada para baixar estoque.
        -- O ERP NexOS geralmente baixa estoque via inventory_movements manualmente no checkout 
        -- ou via trigger em sale_items se for PDV.
    END IF;
    
    RETURN NEW;
END;
$$;

-- Trigger para explodir o kit na venda
DROP TRIGGER IF EXISTS trg_sale_item_kit_explosion ON public.sale_items;
CREATE TRIGGER trg_sale_item_kit_explosion
AFTER INSERT ON public.sale_items
FOR EACH ROW
EXECUTE FUNCTION public.process_kit_stock_decrement();
