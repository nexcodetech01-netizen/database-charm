-- CORREÇÃO (2026-09-16) — Auditoria de duplicação de lógica: achado #2.
--
-- Em 27/08/2026 foi corrigido um buraco do lado das VENDAS: o gatilho que
-- devolvia estoque/financeiro só disparava na transição pra 'cancelled' —
-- se uma venda paga voltasse pra 'draft'/'pending' por qualquer outro
-- motivo (ex.: checkout abandonado), o estoque ficava debitado pra
-- sempre, sem cancelamento formal nenhum. A correção generalizou os
-- gatilhos pra reverter em QUALQUER saída de 'paid', não só pra
-- 'cancelled' (ver 20260827220000_... e 20260827000000_...).
--
-- Esse MESMO problema nunca foi corrigido do lado das COMPRAS: os
-- gatilhos `reverse_purchase_inventory_on_cancel` e
-- `a_cancel_purchase_finance_on_cancel` só disparam quando o status vai
-- especificamente pra 'cancelled' — uma compra Recebida que volte pra
-- 'Rascunho'/'Pendente' (o campo de status na tela de edição aceita
-- qualquer valor) deixa o estoque inflado e a conta a pagar pendente pra
-- sempre, sem erro nenhum aparecendo.
--
-- Corrigido com o mesmo padrão já usado (e comprovado) nas vendas:
-- generaliza as duas condições pra "saiu de received" em vez de "foi
-- pra cancelled" especificamente. O resto da lógica de cada função
-- (idempotência via stock_applied/stock_reversed, reversão de
-- financial_transactions) continua igual, sem mudança.

-- 1) Estoque: reverte em qualquer saída de 'received', não só cancelled.
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
  v_reason text;
BEGIN
  -- CORRIGIDO (2026-09-16): antes só agia na transição especificamente
  -- para 'cancelled'. Agora age sempre que uma compra que ESTAVA
  -- 'received' sai desse status pra QUALQUER outro (cancelled, draft ou
  -- pending) — mesmo critério já usado em reverse_sale_inventory_on_cancel.
  IF (NEW.status = OLD.status)
     OR OLD.status IS DISTINCT FROM 'received'
     OR COALESCE(NEW.stock_reversed, false)
     OR NOT COALESCE(OLD.stock_applied, false) THEN
    RETURN NEW;
  END IF;

  v_reason := CASE
    WHEN NEW.status = 'cancelled' THEN 'Estorno por Cancelamento de Compra'
    ELSE 'Estorno automático — compra voltou de recebida para "' || NEW.status || '" sem cancelamento formal'
  END;

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

    -- Compra adiciona estoque ('in') — reverter precisa RETIRAR ('out').
    INSERT INTO public.inventory_movements (
      company_id, product_id, type, quantity,
      reason, notes, movement_date, user_id,
      source, reference_id, reference_number
    ) VALUES (
      NEW.company_id, item.product_id, 'out', item.quantity,
      v_reason,
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
      'Transição abortada: compra % possui % produto(s) controlado(s), mas somente % entrada(s) puderam ser revertidas.',
      NEW.id, expected_products, reversed_products;
  END IF;

  UPDATE public.purchases
     SET stock_reversed = true,
         stock_applied = false
   WHERE id = NEW.id;

  RETURN NEW;
END;
$function$;

-- 2) Financeiro: dispara em qualquer saída de 'received', não só cancelled.
-- (A função reverse_purchase_finance() em si não muda — ela já lida com
-- qualquer transação 'paid'/'pending'/'overdue' vinculada à compra,
-- independente de qual status novo a compra está indo.)
DROP TRIGGER IF EXISTS a_cancel_purchase_finance_on_cancel ON public.purchases;
CREATE TRIGGER a_cancel_purchase_finance_on_cancel
AFTER UPDATE OF status ON public.purchases
FOR EACH ROW
WHEN (
  OLD.status = 'received'
  AND NEW.status IS DISTINCT FROM 'received'
)
EXECUTE FUNCTION public.cancel_purchase_finance_on_cancel();
