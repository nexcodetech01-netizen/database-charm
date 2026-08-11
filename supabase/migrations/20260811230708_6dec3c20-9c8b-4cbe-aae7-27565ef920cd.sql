DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_type') THEN
        CREATE TYPE public.product_type AS ENUM ('simple', 'kit');
    END IF;
END $$;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_type public.product_type DEFAULT 'simple';

CREATE TABLE IF NOT EXISTS public.product_kit_components (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    parent_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    component_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    quantity numeric NOT NULL DEFAULT 1,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(parent_id, component_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_kit_components TO authenticated;
GRANT ALL ON public.product_kit_components TO service_role;

ALTER TABLE public.product_kit_components ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view kit components of their company') THEN
        CREATE POLICY "Users can view kit components of their company" ON public.product_kit_components
            FOR SELECT TO authenticated USING (company_id = (SELECT current_company_id FROM profiles WHERE id = auth.uid()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can manage kit components of their company') THEN
        CREATE POLICY "Users can manage kit components of their company" ON public.product_kit_components
            FOR ALL TO authenticated USING (company_id = (SELECT current_company_id FROM profiles WHERE id = auth.uid()));
    END IF;
END $$;
