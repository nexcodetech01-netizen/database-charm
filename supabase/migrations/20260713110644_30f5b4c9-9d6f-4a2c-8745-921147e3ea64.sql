
-- Helper: check user owns company
CREATE OR REPLACE FUNCTION public.user_owns_company(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id AND owner_id = auth.uid())
$$;

-- Categories
CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_owner_all" ON public.product_categories FOR ALL TO authenticated
  USING (public.user_owns_company(company_id)) WITH CHECK (public.user_owns_company(company_id));
CREATE TRIGGER trg_product_categories_updated BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Suppliers
CREATE TABLE public.product_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_suppliers TO authenticated;
GRANT ALL ON public.product_suppliers TO service_role;
ALTER TABLE public.product_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sup_owner_all" ON public.product_suppliers FOR ALL TO authenticated
  USING (public.user_owns_company(company_id)) WITH CHECK (public.user_owns_company(company_id));
CREATE TRIGGER trg_product_suppliers_updated BEFORE UPDATE ON public.product_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Products
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  barcode text,
  category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.product_suppliers(id) ON DELETE SET NULL,
  brand text,
  cost numeric(14,2) NOT NULL DEFAULT 0,
  freight numeric(14,2) NOT NULL DEFAULT 0,
  insurance numeric(14,2) NOT NULL DEFAULT 0,
  other_costs numeric(14,2) NOT NULL DEFAULT 0,
  margin numeric(6,2) NOT NULL DEFAULT 0,
  sales_channel text,
  price numeric(14,2) NOT NULL DEFAULT 0,
  stock numeric(14,3) NOT NULL DEFAULT 0,
  min_stock numeric(14,3) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'un',
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  description text,
  cover_image_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_company_idx ON public.products(company_id);
CREATE INDEX products_name_idx ON public.products(company_id, name);
CREATE INDEX products_sku_idx ON public.products(company_id, sku);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prod_owner_all" ON public.products FOR ALL TO authenticated
  USING (public.user_owns_company(company_id)) WITH CHECK (public.user_owns_company(company_id));
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Product images (multi)
CREATE TABLE public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  path text NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_images_product_idx ON public.product_images(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT ALL ON public.product_images TO service_role;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prodimg_owner_all" ON public.product_images FOR ALL TO authenticated
  USING (public.user_owns_company(company_id)) WITH CHECK (public.user_owns_company(company_id));

-- Storage policies for product-images bucket (bucket created via tool)
CREATE POLICY "product_images_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-images' AND public.user_owns_company(((storage.foldername(name))[1])::uuid));
CREATE POLICY "product_images_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.user_owns_company(((storage.foldername(name))[1])::uuid));
CREATE POLICY "product_images_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND public.user_owns_company(((storage.foldername(name))[1])::uuid));
CREATE POLICY "product_images_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.user_owns_company(((storage.foldername(name))[1])::uuid));
