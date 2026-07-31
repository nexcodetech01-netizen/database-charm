
CREATE TABLE public.purchase_receipt_audits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  purchase_item_id UUID REFERENCES public.purchase_items(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL,
  unit_cost NUMERIC NOT NULL,
  previous_stock NUMERIC,
  new_stock NUMERIC,
  previous_cost NUMERIC,
  new_cost NUMERIC,
  reason TEXT NOT NULL,
  notes TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_purchase_receipt_audits_purchase ON public.purchase_receipt_audits(purchase_id);
CREATE INDEX idx_purchase_receipt_audits_product ON public.purchase_receipt_audits(product_id);
CREATE INDEX idx_purchase_receipt_audits_company ON public.purchase_receipt_audits(company_id, created_at DESC);

GRANT SELECT ON public.purchase_receipt_audits TO authenticated;
GRANT ALL ON public.purchase_receipt_audits TO service_role;

ALTER TABLE public.purchase_receipt_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view receipt audits from their companies"
  ON public.purchase_receipt_audits
  FOR SELECT
  TO authenticated
  USING (public.user_has_company_access(company_id));

-- Enhanced trigger with validations + audit log
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
  new_stock NUMERIC;
  v_reason  TEXT;
BEGIN
  IF NEW.status = 'received'
     AND (OLD.status IS DISTINCT FROM 'received')
     AND COALESCE(NEW.stock_applied, false) = false THEN

    FOR item IN
      SELECT pi.id AS item_id, pi.product_id, pi.quantity, pi.unit_price, pi.description
        FROM public.purchase_items pi
       WHERE pi.purchase_id = NEW.id
         AND pi.product_id IS NOT NULL
    LOOP
      -- Validações
      IF COALESCE(item.quantity, 0) <= 0 THEN
        RAISE EXCEPTION 'Item % da compra % possui quantidade inválida (%). Deve ser maior que zero.',
          COALESCE(item.description, item.item_id::text), COALESCE(NEW.number, NEW.id::text), item.quantity
          USING ERRCODE = 'check_violation';
      END IF;

      IF COALESCE(item.unit_price, 0) < 0 THEN
        RAISE EXCEPTION 'Item % da compra % possui custo unitário negativo (%).',
          COALESCE(item.description, item.item_id::text), COALESCE(NEW.number, NEW.id::text), item.unit_price
          USING ERRCODE = 'check_violation';
      END IF;

      -- Lê estoque e custo ANTES da entrada, com lock da linha do produto
      SELECT stock, cost
        INTO cur_stock, cur_cost
        FROM public.products
       WHERE id = item.product_id
       FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Produto % não encontrado ao aplicar recebimento da compra %.',
          item.product_id, COALESCE(NEW.number, NEW.id::text)
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      -- Custo médio ponderado
      IF cur_stock IS NULL OR cur_stock <= 0 OR cur_cost IS NULL THEN
        new_cost := item.unit_price;
      ELSE
        new_cost := ((cur_stock * cur_cost) + (item.quantity * item.unit_price))
                    / (cur_stock + item.quantity);
      END IF;

      new_stock := COALESCE(cur_stock, 0) + item.quantity;
      v_reason  := 'Compra ' || COALESCE(NEW.number, NEW.id::text);

      -- Movimento de entrada (dispara trigger que soma em products.stock)
      INSERT INTO public.inventory_movements(
        company_id, product_id, type, quantity,
        reason, notes, movement_date, user_id,
        source, reference_id, reference_number
      ) VALUES (
        NEW.company_id, item.product_id, 'in', item.quantity,
        'Compra',
        v_reason,
        COALESCE(NEW.received_at, now()),
        NEW.created_by,
        'purchase', NEW.id, NEW.number
      );

      -- Atualiza apenas o custo
      UPDATE public.products
         SET cost = new_cost,
             updated_at = now()
       WHERE id = item.product_id;

      -- Registro de auditoria
      INSERT INTO public.purchase_receipt_audits(
        company_id, purchase_id, purchase_item_id, product_id,
        quantity, unit_cost,
        previous_stock, new_stock,
        previous_cost, new_cost,
        reason, notes, user_id
      ) VALUES (
        NEW.company_id, NEW.id, item.item_id, item.product_id,
        item.quantity, item.unit_price,
        COALESCE(cur_stock, 0), new_stock,
        cur_cost, new_cost,
        'purchase_received',
        v_reason,
        NEW.created_by
      );
    END LOOP;

    UPDATE public.purchases SET stock_applied = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;
