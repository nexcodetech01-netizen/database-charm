CREATE TABLE public.meta_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  meta_business_id TEXT,
  meta_business_name TEXT,
  facebook_page_id TEXT,
  facebook_page_name TEXT,
  facebook_page_token TEXT,
  instagram_business_id TEXT,
  instagram_username TEXT,
  commerce_merchant_settings_id TEXT,
  catalog_id TEXT,
  catalog_name TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.meta_integrations TO service_role;
ALTER TABLE public.meta_integrations ENABLE ROW LEVEL SECURITY;

-- Sem policies para authenticated/anon: apenas service_role (backend) acessa.
-- Server functions autenticadas usam supabaseAdmin após validar company_id do usuário.

CREATE TRIGGER meta_integrations_set_updated_at
BEFORE UPDATE ON public.meta_integrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();