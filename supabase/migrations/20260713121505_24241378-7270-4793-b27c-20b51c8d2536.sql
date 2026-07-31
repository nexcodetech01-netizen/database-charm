
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  birth_date DATE,
  address TEXT,
  address_number TEXT,
  address_complement TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  notes TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  segment TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_interaction_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX customers_company_id_idx ON public.customers(company_id);
CREATE INDEX customers_status_idx ON public.customers(status);
CREATE INDEX customers_name_idx ON public.customers(name);
CREATE INDEX customers_segment_idx ON public.customers(segment);
CREATE INDEX customers_state_idx ON public.customers(state);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company owner manages customers" ON public.customers
  FOR ALL TO authenticated
  USING (public.user_owns_company(company_id))
  WITH CHECK (public.user_owns_company(company_id));
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.customer_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  subject TEXT,
  content TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX customer_interactions_customer_id_idx ON public.customer_interactions(customer_id);
CREATE INDEX customer_interactions_company_id_idx ON public.customer_interactions(company_id);
CREATE INDEX customer_interactions_occurred_at_idx ON public.customer_interactions(occurred_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_interactions TO authenticated;
GRANT ALL ON public.customer_interactions TO service_role;
ALTER TABLE public.customer_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company owner manages customer interactions" ON public.customer_interactions
  FOR ALL TO authenticated
  USING (public.user_owns_company(company_id))
  WITH CHECK (public.user_owns_company(company_id));
CREATE TRIGGER customer_interactions_updated_at BEFORE UPDATE ON public.customer_interactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.bump_customer_last_interaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.customers
     SET last_interaction_at = GREATEST(COALESCE(last_interaction_at, NEW.occurred_at), NEW.occurred_at),
         updated_at = now()
   WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER customer_interactions_bump_last
AFTER INSERT ON public.customer_interactions
FOR EACH ROW EXECUTE FUNCTION public.bump_customer_last_interaction();
