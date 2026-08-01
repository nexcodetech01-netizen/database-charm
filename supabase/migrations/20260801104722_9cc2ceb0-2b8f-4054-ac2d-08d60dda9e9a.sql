CREATE TABLE public.whatsapp_commercial_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  phone text NOT NULL,
  buyer_name text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  item_count integer NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  fulfillment text NOT NULL DEFAULT 'pickup',
  delivery jsonb NOT NULL DEFAULT '{}'::jsonb,
  payment text,
  origin text NOT NULL DEFAULT 'whatsapp',
  status text NOT NULL DEFAULT 'aguardando_atendimento',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX whatsapp_commercial_inbox_open_unique
  ON public.whatsapp_commercial_inbox (company_id, phone)
  WHERE status = 'aguardando_atendimento';

CREATE INDEX whatsapp_commercial_inbox_company_created_idx
  ON public.whatsapp_commercial_inbox (company_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_commercial_inbox TO authenticated;
GRANT ALL ON public.whatsapp_commercial_inbox TO service_role;

ALTER TABLE public.whatsapp_commercial_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_commercial_inbox company access"
  ON public.whatsapp_commercial_inbox
  FOR ALL
  USING (public.user_has_company_access(company_id))
  WITH CHECK (public.user_has_company_access(company_id));

CREATE TRIGGER whatsapp_commercial_inbox_touch_updated_at
  BEFORE UPDATE ON public.whatsapp_commercial_inbox
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();