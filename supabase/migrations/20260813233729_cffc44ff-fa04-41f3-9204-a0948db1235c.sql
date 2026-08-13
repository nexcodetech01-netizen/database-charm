
-- 1. Função para calcular e atualizar o estoque de um kit específico
CREATE OR REPLACE FUNCTION public.refresh_kit_stock(p_parent_id UUID)
RETURNS VOID AS $$
DECLARE
    v_new_stock INTEGER;
BEGIN
    -- Habilita o bypass da trava de estoque para esta transação
    PERFORM set_config('nexos.inventory_engine', 'on', true);

    -- Calcula o menor saldo proporcional (gargalo)
    SELECT COALESCE(MIN(FLOOR(p.stock / pkc.quantity)), 0)::INTEGER
    INTO v_new_stock
    FROM public.product_kit_components pkc
    JOIN public.products p ON p.id = pkc.component_id
    WHERE pkc.parent_id = p_parent_id;

    -- Atualiza a coluna stock na tabela products para o kit
    UPDATE public.products
    SET stock = v_new_stock,
        updated_at = now()
    WHERE id = p_parent_id AND product_type = 'kit';
    
    -- Restaura a trava (opcional, já que 'true' no set_config dura só a transação)
    PERFORM set_config('nexos.inventory_engine', 'off', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger para mudanças na composição do kit
CREATE OR REPLACE FUNCTION public.trg_refresh_kit_stock_on_composition_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.refresh_kit_stock(OLD.parent_id);
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM public.refresh_kit_stock(OLD.parent_id);
        IF NEW.parent_id <> OLD.parent_id THEN
            PERFORM public.refresh_kit_stock(NEW.parent_id);
        END IF;
        RETURN NEW;
    ELSE
        PERFORM public.refresh_kit_stock(NEW.parent_id);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kit_composition_change ON public.product_kit_components;
CREATE TRIGGER trg_kit_composition_change
AFTER INSERT OR UPDATE OR DELETE ON public.product_kit_components
FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_kit_stock_on_composition_change();

-- 3. Trigger para mudanças no estoque de produtos que podem ser componentes de kits
CREATE OR REPLACE FUNCTION public.trg_refresh_kit_stock_on_inventory_change()
RETURNS TRIGGER AS $$
DECLARE
    r RECORD;
BEGIN
    -- Quando o estoque de um produto muda, precisamos atualizar todos os kits que o contêm
    FOR r IN SELECT DISTINCT parent_id FROM public.product_kit_components WHERE component_id = NEW.id LOOP
        PERFORM public.refresh_kit_stock(r.parent_id);
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kit_component_inventory_change ON public.products;
CREATE TRIGGER trg_kit_component_inventory_change
AFTER UPDATE OF stock ON public.products
FOR EACH ROW
WHEN (NEW.product_type = 'simple')
EXECUTE FUNCTION public.trg_refresh_kit_stock_on_inventory_change();

-- 4. Backfill: Atualizar todos os kits existentes agora
DO $$
DECLARE
    kit_id UUID;
BEGIN
    FOR kit_id IN SELECT id FROM public.products WHERE product_type = 'kit' LOOP
        PERFORM public.refresh_kit_stock(kit_id);
    END LOOP;
END $$;
