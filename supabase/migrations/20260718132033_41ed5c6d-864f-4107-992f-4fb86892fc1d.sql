
-- Propaga alterações de margem alvo da categoria para produtos que usam a margem da categoria.
-- Produtos com use_category_margin = false (margem personalizada) NÃO são alterados.

CREATE OR REPLACE FUNCTION public.apply_category_margin_to_products()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_margin numeric;
BEGIN
  -- Só age quando a margem alvo da categoria muda
  IF NEW.target_margin_pct IS NOT DISTINCT FROM OLD.target_margin_pct THEN
    RETURN NEW;
  END IF;

  new_margin := NEW.target_margin_pct;

  -- Sem margem definida na categoria: nada a propagar
  IF new_margin IS NULL THEN
    RETURN NEW;
  END IF;

  -- Evita divisão por zero / margens inválidas
  IF new_margin <= 0 OR new_margin >= 100 THEN
    RETURN NEW;
  END IF;

  UPDATE public.products p
     SET margin = new_margin,
         price = ROUND(
           (COALESCE(p.cost,0) + COALESCE(p.freight,0) + COALESCE(p.insurance,0)
            + COALESCE(p.packaging,0) + COALESCE(p.other_costs,0))
           / (1 - (new_margin / 100.0))
         , 2),
         updated_at = now()
   WHERE p.company_id = NEW.company_id
     AND p.category_id = NEW.id
     AND COALESCE(p.use_category_margin, false) = true;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_category_margin_to_products ON public.product_categories;
CREATE TRIGGER trg_apply_category_margin_to_products
AFTER UPDATE OF target_margin_pct ON public.product_categories
FOR EACH ROW
EXECUTE FUNCTION public.apply_category_margin_to_products();
