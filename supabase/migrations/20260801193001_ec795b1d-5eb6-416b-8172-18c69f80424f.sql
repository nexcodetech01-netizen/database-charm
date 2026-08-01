CREATE TYPE public.interest_channel AS ENUM ('facebook','instagram','whatsapp','loja','telefone','outro');
CREATE TYPE public.interest_status AS ENUM ('aguardando','disponivel','avisado','concluido','cancelado');

CREATE TABLE public.product_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  phone text,
  channel public.interest_channel NOT NULL DEFAULT 'outro',
  notes text,
  interest_date date NOT NULL DEFAULT CURRENT_DATE,
  responsible_user_id uuid,
  status public.interest_status NOT NULL DEFAULT 'aguardando',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_interests_company ON public.product_interests (company_id, status);
CREATE INDEX idx_product_interests_product ON public.product_interests (product_id, status);
CREATE INDEX idx_product_interests_customer ON public.product_interests (customer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_interests TO authenticated;
GRANT ALL ON public.product_interests TO service_role;

ALTER TABLE public.product_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view interests"
  ON public.product_interests FOR SELECT TO authenticated
  USING (public.user_has_company_access(company_id));

CREATE POLICY "Company members can create interests"
  ON public.product_interests FOR INSERT TO authenticated
  WITH CHECK (public.user_has_company_access(company_id));

CREATE POLICY "Company members can update interests"
  ON public.product_interests FOR UPDATE TO authenticated
  USING (public.user_has_company_access(company_id))
  WITH CHECK (public.user_has_company_access(company_id));

CREATE POLICY "Company members can delete interests"
  ON public.product_interests FOR DELETE TO authenticated
  USING (public.user_has_company_access(company_id));

CREATE TRIGGER trg_product_interests_updated_at
  BEFORE UPDATE ON public.product_interests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();