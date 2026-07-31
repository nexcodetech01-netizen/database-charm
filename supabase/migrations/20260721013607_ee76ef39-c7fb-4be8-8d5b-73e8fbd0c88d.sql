CREATE TABLE public.mercadolivre_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_id TEXT NOT NULL,
  client_secret_encrypted TEXT NOT NULL,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  ml_user_id TEXT,
  ml_nickname TEXT,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.mercadolivre_integrations TO service_role;
ALTER TABLE public.mercadolivre_integrations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER mercadolivre_integrations_set_updated_at
BEFORE UPDATE ON public.mercadolivre_integrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();