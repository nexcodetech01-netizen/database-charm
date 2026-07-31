
CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in','out','adjustment','transfer')),
  quantity NUMERIC NOT NULL,
  reason TEXT,
  notes TEXT,
  movement_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inv_mov_company_date ON public.inventory_movements(company_id, movement_date DESC);
CREATE INDEX idx_inv_mov_product_date ON public.inventory_movements(product_id, movement_date DESC);
CREATE INDEX idx_inv_mov_type ON public.inventory_movements(company_id, type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY invmov_owner_all ON public.inventory_movements
  FOR ALL TO authenticated
  USING (public.user_owns_company(company_id))
  WITH CHECK (public.user_owns_company(company_id));

CREATE TRIGGER set_inv_mov_updated_at
  BEFORE UPDATE ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: apply movement to product stock
CREATE OR REPLACE FUNCTION public.apply_inventory_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delta NUMERIC := 0;
BEGIN
  IF NEW.type = 'in' THEN
    delta := ABS(NEW.quantity);
  ELSIF NEW.type = 'out' THEN
    delta := -ABS(NEW.quantity);
  ELSIF NEW.type = 'adjustment' THEN
    delta := NEW.quantity; -- signed delta
  ELSIF NEW.type = 'transfer' THEN
    delta := 0; -- reserved for future
  END IF;

  IF delta <> 0 THEN
    UPDATE public.products
       SET stock = stock + delta,
           updated_at = now()
     WHERE id = NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER apply_inv_mov_after_insert
  AFTER INSERT ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_inventory_movement();
