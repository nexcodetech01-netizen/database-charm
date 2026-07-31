ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_sales_company_is_test ON public.sales(company_id, is_test);

ALTER TABLE public.fiscal_settings
  ADD COLUMN IF NOT EXISTS homologation_mode boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS stock_on_homologation boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.fiscal_guard_environment_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.environment IS DISTINCT FROM NEW.environment THEN
    RAISE EXCEPTION 'Ambiente do documento fiscal e imutavel (% -> %). Nao e permitido misturar homologacao e producao.', OLD.environment, NEW.environment;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fiscal_documents_environment_immutable ON public.fiscal_documents;
CREATE TRIGGER trg_fiscal_documents_environment_immutable
BEFORE UPDATE ON public.fiscal_documents
FOR EACH ROW EXECUTE FUNCTION public.fiscal_guard_environment_immutable();

CREATE OR REPLACE FUNCTION public.mark_sale_as_test_from_fiscal_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale RECORD;
  v_keep_stock boolean;
  item RECORD;
BEGIN
  IF NEW.sale_id IS NULL OR NEW.environment <> 'homologation' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_sale FROM public.sales WHERE id = NEW.sale_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF COALESCE(v_sale.is_test, false) = false THEN
    UPDATE public.sales SET is_test = true WHERE id = v_sale.id;
  END IF;

  SELECT COALESCE(fs.stock_on_homologation, true) INTO v_keep_stock
    FROM public.fiscal_settings fs WHERE fs.company_id = NEW.company_id;
  v_keep_stock := COALESCE(v_keep_stock, true);

  IF v_keep_stock = false
     AND COALESCE(v_sale.stock_applied, false) = true
     AND COALESCE(v_sale.stock_reversed, false) = false THEN
    FOR item IN
      SELECT si.product_id, si.quantity
        FROM public.sale_items si
       WHERE si.sale_id = v_sale.id AND si.product_id IS NOT NULL
    LOOP
      INSERT INTO public.inventory_movements(
        company_id, product_id, type, quantity,
        reason, notes, movement_date, user_id,
        source, reference_id, reference_number
      ) VALUES (
        v_sale.company_id, item.product_id, 'in', item.quantity,
        'Estorno homologacao',
        'Venda de teste (NF-e homologacao) ' || COALESCE(v_sale.number, v_sale.id::text),
        now(), v_sale.created_by,
        'sale', v_sale.id, v_sale.number
      );
    END LOOP;
    UPDATE public.sales SET stock_reversed = true WHERE id = v_sale.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fiscal_documents_mark_test_sale ON public.fiscal_documents;
CREATE TRIGGER trg_fiscal_documents_mark_test_sale
AFTER INSERT OR UPDATE OF environment, sale_id ON public.fiscal_documents
FOR EACH ROW EXECUTE FUNCTION public.mark_sale_as_test_from_fiscal_document();

UPDATE public.sales s
   SET is_test = true
 WHERE COALESCE(s.is_test, false) = false
   AND EXISTS (
     SELECT 1 FROM public.fiscal_documents fd
      WHERE fd.sale_id = s.id AND fd.environment = 'homologation'
   );