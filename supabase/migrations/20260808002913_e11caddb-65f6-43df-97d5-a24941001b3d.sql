
-- SPRINT: CORREÇÃO DE BAIXA DE ESTOQUE EM VENDAS NO CREDIÁRIO / PENDENTES
-- Objetivo: Garantir que o estoque seja baixado imediatamente na criação da venda, independente do status ser 'paid'.

CREATE OR REPLACE FUNCTION public.apply_sale_to_inventory()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
BEGIN
  -- NOVA REGRA: Baixa estoque se:
  -- 1. A venda NÃO é rascunho (status != 'draft')
  -- 2. Ainda não foi aplicado (stock_applied = false)
  -- 3. NÃO é cancelada ou estornada (esses têm trigger de reversão)
  IF NEW.status IN ('paid', 'pending', 'partially_paid')
     AND COALESCE(NEW.stock_applied, false) = false THEN

    FOR item IN
      SELECT si.product_id, si.quantity
        FROM public.sale_items si
       WHERE si.sale_id = NEW.id
         AND si.product_id IS NOT NULL
    LOOP
      -- Registra a saída no estoque via motor de movimentos
      INSERT INTO public.inventory_movements(
        company_id, product_id, type, quantity,
        reason, notes, movement_date, user_id,
        source, reference_id, reference_number
      ) VALUES (
        NEW.company_id, item.product_id, 'out', item.quantity,
        'Venda',
        'Venda ' || COALESCE(NEW.number, NEW.id::text),
        COALESCE(NEW.sale_date, now()),
        NEW.created_by,
        'sale', NEW.id, NEW.number
      );
    END LOOP;

    -- Marca como aplicado para evitar duplicidade em futuros updates de status
    UPDATE public.sales SET stock_applied = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

-- SANEAMENTO DO ITEM ESPECÍFICO REL-RED-PRE-001
-- Se a venda PDV-20260807-210312 não baixou estoque, forçamos agora.
-- Nota: O trigger acima cuidará de qualquer venda que ainda não tenha stock_applied = true se houver um update nela,
-- mas aqui fazemos o saneamento manual do registro citado para garantir o estoque correto 1 -> 0.

DO $$
DECLARE
  v_sale_id uuid;
  v_product_id uuid;
  v_company_id uuid;
  v_qty numeric;
  v_user_id uuid;
  v_number text;
BEGIN
  -- Busca dados da venda específica
  SELECT s.id, si.product_id, s.company_id, si.quantity, s.created_by, s.number
  INTO v_sale_id, v_product_id, v_company_id, v_qty, v_user_id, v_number
  FROM public.sales s
  JOIN public.sale_items si ON si.sale_id = s.id
  JOIN public.products p ON p.id = si.product_id
  WHERE (s.number = 'PDV-20260807-210312' OR p.sku = 'REL-RED-PRE-001')
    AND s.status IN ('pending', 'partially_paid')
    AND COALESCE(s.stock_applied, false) = false
  LIMIT 1;

  IF v_sale_id IS NOT NULL THEN
    -- Aplica o movimento manualmente
    INSERT INTO public.inventory_movements(
      company_id, product_id, type, quantity,
      reason, notes, movement_date, user_id,
      source, reference_id, reference_number
    ) VALUES (
      v_company_id, v_product_id, 'out', v_qty,
      'Saneamento de Estoque',
      'Baixa retroativa venda ' || v_number,
      now(),
      v_user_id,
      'sale', v_sale_id, v_number
    );
    
    UPDATE public.sales SET stock_applied = true WHERE id = v_sale_id;
  END IF;
END $$;
