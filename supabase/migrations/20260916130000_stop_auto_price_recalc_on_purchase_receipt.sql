-- CORREÇÃO (2026-09-16) — Auditoria de duplicação de lógica: achado #1.
--
-- `apply_purchase_to_inventory` chamava `recalculate_product_v2_price`
-- automaticamente toda vez que uma compra era marcada como Recebida. Essa
-- função usa uma fórmula própria e simplificada (Custo / (1 - Margem/100),
-- arredondado pra baixo + R$0,90) que NUNCA considera taxa de
-- cartão/parcelamento nem política de arredondamento configurável —
-- diferente do motor oficial do sistema (`computeSuggestedPrice`, em
-- src/features/pricing/official/), que é a ÚNICA porta de entrada
-- permitida pra formação de preço (ver o cabeçalho de
-- official-pricing.ts: "Proibido em qualquer outro arquivo do sistema:
-- ... dividir custo por (1 - margem) ... aplicar taxa de canal/imposto
-- manualmente ... arredondar preço comercial").
--
-- Isso também contraria uma regra já documentada em
-- src/features/pricing/lib/category-recalc.functions.ts: "Produtos
-- existentes NUNCA são alterados de forma automática: o usuário pede a
-- prévia, revisa e só então confirma a aplicação". Receber uma compra
-- SEMPRE alterava o preço de produtos existentes sem revisão nenhuma —
-- e, por ignorar a taxa de cartão, sempre pra um valor MAIS BAIXO do que
-- o motor oficial calcularia (risco de subprecificação silenciosa).
--
-- Corrigido: removida a chamada automática de dentro do gatilho de
-- recebimento de compra. `products.cost`/`freight`/`other_costs`
-- continuam sendo atualizados normalmente a cada compra recebida (isso
-- nunca teve duplicidade, mantido como está) — só o PREÇO deixa de ser
-- recalculado sozinho. Quem quiser atualizar o preço de produtos
-- existentes depois de um novo custo pode usar a tela de recálculo por
-- categoria (previewCategoryRecalc/applyCategoryRecalc), que já usa o
-- motor oficial e sempre pede confirmação antes de aplicar.
--
-- A função `recalculate_product_v2_price` continua existindo no banco
-- (não removida) — só deixou de ser chamada automaticamente aqui — pra
-- não quebrar nada que ainda dependa dela existir.

CREATE OR REPLACE FUNCTION public.apply_purchase_to_inventory()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
  cur_stock NUMERIC;
  cur_cost  NUMERIC;
  new_cost  NUMERIC;
  v_items_base NUMERIC;
  v_share NUMERIC;
  v_unit_price NUMERIC;
  v_freight_unit NUMERIC;
  v_other_unit NUMERIC;
  v_other_total NUMERIC;
BEGIN
  IF NEW.status = 'received'
     AND (OLD.status IS DISTINCT FROM 'received')
     AND COALESCE(NEW.stock_applied, false) = false THEN

    SELECT COALESCE(SUM(COALESCE(pi.quantity, 0) * COALESCE(pi.unit_price, 0)), 0)
      INTO v_items_base FROM public.purchase_items pi WHERE pi.purchase_id = NEW.id;

    v_other_total := GREATEST(COALESCE(NEW.other_costs, 0) - COALESCE(NEW.discount, 0), 0);

    FOR item IN
      SELECT pi.id AS item_id, pi.product_id, pi.quantity, pi.unit_price, pi.description
        FROM public.purchase_items pi
       WHERE pi.purchase_id = NEW.id AND pi.product_id IS NOT NULL
    LOOP
      v_unit_price := ROUND(COALESCE(item.unit_price, 0), 6);

      IF v_items_base > 0 THEN
        v_share := (COALESCE(item.quantity, 0) * COALESCE(item.unit_price, 0)) / v_items_base;
      ELSE
        v_share := 0;
      END IF;

      v_freight_unit := ROUND((COALESCE(NEW.shipping, 0)  * v_share) / item.quantity, 6);
      v_other_unit   := ROUND((v_other_total              * v_share) / item.quantity, 6);

      SELECT stock, cost INTO cur_stock, cur_cost
        FROM public.products WHERE id = item.product_id FOR UPDATE;

      IF cur_stock IS NULL OR cur_stock <= 0 OR cur_cost IS NULL THEN
        new_cost := v_unit_price;
      ELSE
        new_cost := ((cur_stock * cur_cost) + (item.quantity * v_unit_price)) / (cur_stock + item.quantity);
      END IF;
      new_cost := ROUND(new_cost, 6);

      -- Movimentação de estoque — isso sozinho JÁ soma a quantidade
      -- ao estoque do produto, através do gatilho
      -- `trg_apply_inventory_movement` (existe desde 13/07/2026).
      INSERT INTO public.inventory_movements(
        company_id, product_id, type, quantity, reason, notes, movement_date, user_id,
        source, reference_id, reference_number, unit_cost, total_cost
      ) VALUES (
        NEW.company_id, item.product_id, 'in', item.quantity, 'Compra',
        'Compra ' || COALESCE(NEW.number, NEW.id::text) || ' (Rateio: Frete ' || v_freight_unit || ', Outros ' || v_other_unit || ')',
        COALESCE(NEW.received_at, now()), NEW.created_by,
        'purchase', NEW.id, NEW.number, v_unit_price, ROUND(v_unit_price * item.quantity, 6)
      );

      UPDATE public.products
         SET cost = new_cost,
             freight = COALESCE(v_freight_unit, 0),
             other_costs = COALESCE(v_other_unit, 0),
             updated_at = now()
       WHERE id = item.product_id;

      -- CORRIGIDO (2026-09-16): removida a chamada automática de
      -- recalculate_product_v2_price daqui — ver comentário no topo
      -- desta migration. Preço de produto existente não muda mais
      -- sozinho ao receber uma compra.
    END LOOP;

    UPDATE public.purchases SET stock_applied = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;
