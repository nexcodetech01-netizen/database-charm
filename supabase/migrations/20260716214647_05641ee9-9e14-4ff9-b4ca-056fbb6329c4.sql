-- Catálogo Inteligente: coleções de produtos
CREATE TABLE public.product_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','hidden','scheduled')),
  scheduled_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, slug)
);

CREATE INDEX idx_product_collections_company ON public.product_collections(company_id);
CREATE INDEX idx_product_collections_slug ON public.product_collections(slug);
CREATE INDEX idx_product_collections_status ON public.product_collections(status);

GRANT SELECT ON public.product_collections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_collections TO authenticated;
GRANT ALL ON public.product_collections TO service_role;

ALTER TABLE public.product_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own company collections"
  ON public.product_collections FOR SELECT
  TO authenticated
  USING (public.user_owns_company(company_id) OR public.has_permission(auth.uid(), company_id, 'marketing.view'));

CREATE POLICY "Members can insert collections"
  ON public.product_collections FOR INSERT
  TO authenticated
  WITH CHECK (public.user_owns_company(company_id) OR public.has_permission(auth.uid(), company_id, 'marketing.manage'));

CREATE POLICY "Members can update collections"
  ON public.product_collections FOR UPDATE
  TO authenticated
  USING (public.user_owns_company(company_id) OR public.has_permission(auth.uid(), company_id, 'marketing.manage'))
  WITH CHECK (public.user_owns_company(company_id) OR public.has_permission(auth.uid(), company_id, 'marketing.manage'));

CREATE POLICY "Members can delete collections"
  ON public.product_collections FOR DELETE
  TO authenticated
  USING (public.user_owns_company(company_id) OR public.has_permission(auth.uid(), company_id, 'marketing.manage'));

CREATE POLICY "Anonymous can view active collections"
  ON public.product_collections FOR SELECT
  TO anon
  USING (status = 'active');

CREATE TRIGGER trg_product_collections_updated_at
  BEFORE UPDATE ON public.product_collections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Itens (relação coleção <-> produto existente, sem duplicação)
CREATE TABLE public.product_collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.product_collections(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (collection_id, product_id)
);

CREATE INDEX idx_product_collection_items_collection ON public.product_collection_items(collection_id);
CREATE INDEX idx_product_collection_items_product ON public.product_collection_items(product_id);

GRANT SELECT ON public.product_collection_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_collection_items TO authenticated;
GRANT ALL ON public.product_collection_items TO service_role;

ALTER TABLE public.product_collection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view items of own collections"
  ON public.product_collection_items FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.product_collections c
     WHERE c.id = collection_id
       AND (public.user_owns_company(c.company_id)
            OR public.has_permission(auth.uid(), c.company_id, 'marketing.view'))
  ));

CREATE POLICY "Members can insert items"
  ON public.product_collection_items FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.product_collections c
     WHERE c.id = collection_id
       AND (public.user_owns_company(c.company_id)
            OR public.has_permission(auth.uid(), c.company_id, 'marketing.manage'))
  ));

CREATE POLICY "Members can update items"
  ON public.product_collection_items FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.product_collections c
     WHERE c.id = collection_id
       AND (public.user_owns_company(c.company_id)
            OR public.has_permission(auth.uid(), c.company_id, 'marketing.manage'))
  ));

CREATE POLICY "Members can delete items"
  ON public.product_collection_items FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.product_collections c
     WHERE c.id = collection_id
       AND (public.user_owns_company(c.company_id)
            OR public.has_permission(auth.uid(), c.company_id, 'marketing.manage'))
  ));

CREATE POLICY "Anonymous can view items of active collections"
  ON public.product_collection_items FOR SELECT
  TO anon
  USING (EXISTS (
    SELECT 1 FROM public.product_collections c
     WHERE c.id = collection_id
       AND c.status = 'active'
  ));
