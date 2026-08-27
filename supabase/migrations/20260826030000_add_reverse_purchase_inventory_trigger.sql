-- BUG ATIVO ENCONTRADO E CORRIGIDO (2026-08-26): mesmo padrão do
-- financeiro (já corrigido hoje), só que no ESTOQUE — cancelar uma
-- compra JÁ RECEBIDA (que já somou estoque via
-- `apply_purchase_to_inventory`) nunca tira esse estoque de volta.
-- Vendas já têm essa proteção desde 20/07/2026
-- (`reverse_sale_inventory_on_cancel`); compras nunca tiveram.
--
-- Resultado possível: cancelar uma compra recebida deixa o estoque
-- MAIOR do que deveria (contando produtos que, na prática, nunca
-- deveriam ter entrado, já que a compra foi cancelada) — o mesmo tipo
-- de inconsistência silenciosa que já vimos hoje no financeiro, agora
-- no estoque.
--
-- Corrigido com o mesmo padrão já usado (e comprovado) nas vendas:
-- adiciona a coluna `stock_reversed` em `purchases` (só faltava essa,
-- `stock_applied` já existia) e cria um gatilho espelhando
-- `reverse_sale_inventory_on_cancel`, adaptado pra compras (reverte
-- SAÍDA de estoque em vez de reverter ENTRADA, já que compra
-- adiciona estoque, então cancelar precisa RETIRAR).

ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS stock_reversed boolean NOT NULL DEFAULT false;

-- Idempotência forte (mesmo padrão das vendas): uma única compensação
-- por compra e produto — sem isso, o ON CONFLICT abaixo não funciona.
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_purchase_cancellation_product
  ON public.inventory_movements (reference_id, product_id)
  WHERE source = 'purchase_cancellation';

CREATE OR REPLACE FUNCTION public.reverse_purchase_inventory_on_cancel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item record;
  inserted_id uuid;
  reversed_products integer := 0;
  expected_products integer := 0;
BEGIN
  -- Só age na transição para 'cancelled'
  IF NEW.status IS DISTINCT FROM 'cancelled' OR OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Só reverte se o estoque foi aplicado (compra recebida) e ainda
  -- não foi revertido.
  IF COALESCE(NEW.stock_applied, false) = false OR COALESCE(NEW.stock_reversed, false) = true THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(DISTINCT pi.product_id)
    INTO expected_products
    FROM public.purchase_items pi
   WHERE pi.purchase_id = NEW.id
     AND pi.product_id IS NOT NULL
     AND COALESCE(pi.quantity, 0) > 0;

  FOR item IN
    SELECT im.product_id, SUM(ABS(im.quantity)) AS quantity
      FROM public.inventory_movements im
     WHERE im.company_id = NEW.company_id
       AND im.source = 'purchase'
       AND im.reference_id = NEW.id
       AND im.type = 'in'
       AND im.product_id IS NOT NULL
       AND COALESCE(im.quantity, 0) <> 0
     GROUP BY im.product_id
  LOOP
    inserted_id := NULL;

    -- Compra adiciona estoque ('in') — cancelar precisa RETIRAR
    -- ('out'), o inverso do que a venda faz.
    INSERT INTO public.inventory_movements (
      company_id, product_id, type, quantity,
      reason, notes, movement_date, user_id,
      source, reference_id, reference_number
    ) VALUES (
      NEW.company_id, item.product_id, 'out', item.quantity,
      'Estorno por Cancelamento de Compra',
      'Estorno da compra ' || COALESCE(NEW.number, NEW.id::text),
      now(), NEW.created_by,
      'purchase_cancellation', NEW.id, NEW.number
    )
    ON CONFLICT (reference_id, product_id)
      WHERE source = 'purchase_cancellation'
    DO NOTHING
    RETURNING id INTO inserted_id;

    IF inserted_id IS NOT NULL OR EXISTS (
      SELECT 1
        FROM public.inventory_movements existing
       WHERE existing.source = 'purchase_cancellation'
         AND existing.reference_id = NEW.id
         AND existing.product_id = item.product_id
    ) THEN
      reversed_products := reversed_products + 1;
    ELSE
      RAISE EXCEPTION
        'Falha ao registrar reversão de estoque da compra % para o produto %.',
        NEW.id, item.product_id;
    END IF;
    -- Não precisa atualizar `products.stock` manualmente aqui — o
    -- gatilho `apply_inventory_movement` (já existente no sistema)
    -- dispara sozinho ao inserir a linha acima em
    -- `inventory_movements` e ajusta o estoque do produto conforme o
    -- `type` do movimento ('out' aqui = tira do estoque). Fazer isso
    -- de novo aqui contaria a redução em dobro.
  END LOOP;

  IF expected_products > 0 AND reversed_products <> expected_products THEN
    RAISE EXCEPTION
      'Cancelamento abortado: compra % possui % produto(s) controlado(s), mas somente % entrada(s) puderam ser revertidas.',
      NEW.id, expected_products, reversed_products;
  END IF;

  UPDATE public.purchases
     SET stock_reversed = true,
         stock_applied = false
   WHERE id = NEW.id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_reverse_purchase_inventory_on_cancel ON public.purchases;
CREATE TRIGGER trg_reverse_purchase_inventory_on_cancel
AFTER UPDATE OF status ON public.purchases
FOR EACH ROW
EXECUTE FUNCTION public.reverse_purchase_inventory_on_cancel();
