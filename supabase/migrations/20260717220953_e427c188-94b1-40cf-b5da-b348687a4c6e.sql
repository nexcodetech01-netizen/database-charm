
CREATE TABLE public.company_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role_id UUID NOT NULL REFERENCES public.roles(id),
  token TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX company_invites_company_id_idx ON public.company_invites(company_id);
CREATE INDEX company_invites_token_idx ON public.company_invites(token);
CREATE INDEX company_invites_email_idx ON public.company_invites(lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_invites TO authenticated;
GRANT ALL ON public.company_invites TO service_role;

ALTER TABLE public.company_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage invites of their companies"
  ON public.company_invites FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_invites.company_id AND c.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_invites.company_id AND c.owner_id = auth.uid()
    )
  );

CREATE TRIGGER update_company_invites_updated_at
  BEFORE UPDATE ON public.company_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
