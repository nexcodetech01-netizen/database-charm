-- Lista de compras (2026-09-07)
--
-- Lista simples pra marcar o que quer comprar (ex.: antes de uma
-- viagem de compras no Brás). Cada item pode ser um produto já
-- cadastrado (product_id preenchido) ou algo novo, ainda sem cadastro
-- (só o nome digitado). Marca como "comprado" ao invés de apagar, pra
-- manter histórico, mas dá pra apagar também se quiser.

CREATE TABLE public.shopping_list_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  notes text,
  checked boolean NOT NULL DEFAULT false,
  checked_at timestamp with time zone,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_shopping_list_items_company ON public.shopping_list_items(company_id);
CREATE INDEX idx_shopping_list_items_product ON public.shopping_list_items(product_id) WHERE product_id IS NOT NULL;

ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shopping_list_items_select" ON public.shopping_list_items
  FOR SELECT USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "shopping_list_items_insert" ON public.shopping_list_items
  FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "shopping_list_items_update" ON public.shopping_list_items
  FOR UPDATE USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "shopping_list_items_delete" ON public.shopping_list_items
  FOR DELETE USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE TRIGGER set_updated_at_shopping_list_items
  BEFORE UPDATE ON public.shopping_list_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
