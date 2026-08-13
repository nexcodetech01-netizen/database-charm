-- FIX — Estoque de Kit: timing errado + desconto fantasma no produto "pai".
--
-- Bugs encontrados (auditoria de 2026-08-13):
--
--   1. TIMING: o gatilho trg_sale_item_kit_explosion disparava em
--      AFTER INSERT ON sale_items — ou seja, os componentes do kit
--      (capinha, película, cabo etc.) eram baixados do estoque assim que
--      o item entrava na venda, ANTES de qualquer confirmação de
--      pagamento. Produtos simples só baixam estoque quando a venda vira
--      'paid' (via apply_sale_to_inventory, disparado em AFTER UPDATE ON
--      sales). Resultado: um kit num carrinho abandonado ou numa venda
--      cancelada antes do pagamento deixava o estoque dos componentes
--      descontado incorretamente, sem devolução automática.
--
--   2. DESCONTO FANTASMA: apply_sale_to_inventory() percorre todo item
--      de sale_items sem checar o tipo do produto — para um kit, ele
--      também tentava descontar estoque do PRÓPRIO produto "kit" (que não
--      tem estoque físico real, é só um cálculo em cima dos componentes).
--      Se esse campo estivesse baixo/zerado, isso podia bloquear a venda
--      inteira com "estoque insuficiente" no kit, mesmo com os
--      componentes reais disponíveis.
--
-- Correção: uma função só (apply_sale_to_inventory), disparada só quando
-- a venda vira 'paid' — para item tipo 'kit', explode nos componentes reais
-- e NUNCA mexe no estoque do produto "pai"; para item simples, comportamento
-- inalterado.

CREATE OR REPLACE FUNCTION public.apply_sale_to_inventory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  component_record RECORD;
  v_product_type public.product_type;
BEGIN
  IF NEW.status = 'paid'
     AND (OLD.status IS DISTINCT FROM 'paid')
     AND COALESCE(NEW.stock_applied, false) = false THEN

    FOR item IN
      SELECT si.product_id, si.quantity
        FROM public.sale_items si
       WHERE si.sale_id = NEW.id
         AND si.product_id IS NOT NULL
    LOOP
      SELECT product_type INTO v_product_type
        FROM public.products
       WHERE id = item.product_id;

      IF v_product_type = 'kit' THEN
        -- Kit: nunca baixa o produto "pai" (estoque virtual/calculado
        -- pelo gargalo dos componentes) — só os componentes reais.
        FOR component_record IN
          SELECT component_id, quantity
            FROM public.product_kit_components
           WHERE parent_id = item.product_id
        LOOP
          INSERT INTO public.inventory_movements(
            company_id, product_id, type, quantity,
            reason, notes, movement_date, user_id,
            source, reference_id, reference_number
          ) VALUES (
            NEW.company_id, component_record.component_id, 'out',
            (item.quantity * component_record.quantity),
            'Venda (kit)',
            'Baixa automática por venda de Kit — Venda ' || COALESCE(NEW.number, NEW.id::text),
            COALESCE(NEW.paid_at, now()),
            NEW.created_by,
            'sale_kit_explosion', NEW.id, NEW.number
          );
        END LOOP;
      ELSE
        INSERT INTO public.inventory_movements(
          company_id, product_id, type, quantity,
          reason, notes, movement_date, user_id,
          source, reference_id, reference_number
        ) VALUES (
          NEW.company_id, item.product_id, 'out', item.quantity,
          'Venda',
          'Venda ' || COALESCE(NEW.number, NEW.id::text),
          COALESCE(NEW.paid_at, now()),
          NEW.created_by,
          'sale', NEW.id, NEW.number
        );
      END IF;
    END LOOP;

    UPDATE public.sales SET stock_applied = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Remove o gatilho antigo (timing errado — disparava no insert do item,
-- não na confirmação de pagamento). A explosão de kit agora acontece
-- dentro de apply_sale_to_inventory acima, no momento certo.
DROP TRIGGER IF EXISTS trg_sale_item_kit_explosion ON public.sale_items;
DROP FUNCTION IF EXISTS public.process_kit_stock_decrement();
