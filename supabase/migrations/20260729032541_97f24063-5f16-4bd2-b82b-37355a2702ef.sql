-- 1) Colunas de metadados/senha em fiscal_certificates
ALTER TABLE public.fiscal_certificates
  ADD COLUMN IF NOT EXISTS password_encrypted bytea,
  ADD COLUMN IF NOT EXISTS thumbprint text,
  ADD COLUMN IF NOT EXISTS content_type text DEFAULT 'application/x-pkcs12';

-- 2) fiscal_provider_config
CREATE TABLE IF NOT EXISTS public.fiscal_provider_config (
  company_id  uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  provider_id text NOT NULL DEFAULT 'mock',
  environment text NOT NULL DEFAULT 'homologation'
    CHECK (environment IN ('homologation','production')),
  updated_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_provider_config TO authenticated;
GRANT ALL ON public.fiscal_provider_config TO service_role;

ALTER TABLE public.fiscal_provider_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fiscal_provider_config_select ON public.fiscal_provider_config;
CREATE POLICY fiscal_provider_config_select ON public.fiscal_provider_config
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), company_id, 'fiscal.view'));

DROP POLICY IF EXISTS fiscal_provider_config_write ON public.fiscal_provider_config;
CREATE POLICY fiscal_provider_config_write ON public.fiscal_provider_config
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), company_id, 'fiscal.manage'))
  WITH CHECK (public.has_permission(auth.uid(), company_id, 'fiscal.manage'));

DROP TRIGGER IF EXISTS trg_fiscal_provider_config_touch ON public.fiscal_provider_config;
CREATE TRIGGER trg_fiscal_provider_config_touch
  BEFORE UPDATE ON public.fiscal_provider_config
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

INSERT INTO public.fiscal_provider_config (company_id)
SELECT id FROM public.companies
ON CONFLICT (company_id) DO NOTHING;

-- 3) Permissão fiscal.manage (com coluna action obrigatória)
INSERT INTO public.permissions (code, module, action, description)
VALUES ('fiscal.manage', 'fiscal', 'manage', 'Administrar módulo Fiscal (emissão, cancelamento, certificado, provedor)')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p2.id
FROM public.role_permissions rp
JOIN public.permissions p1 ON p1.id = rp.permission_id AND p1.code = 'fiscal.create'
JOIN public.permissions p2 ON p2.code = 'fiscal.manage'
ON CONFLICT DO NOTHING;

-- 4) Storage RLS — fiscal-artifacts (path: <company_id>/<document_id>/<file>)
DROP POLICY IF EXISTS fiscal_artifacts_select ON storage.objects;
CREATE POLICY fiscal_artifacts_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'fiscal-artifacts'
    AND public.has_permission(
      auth.uid(),
      NULLIF((storage.foldername(name))[1], '')::uuid,
      'fiscal.view'
    )
  );

DROP POLICY IF EXISTS fiscal_artifacts_write ON storage.objects;
CREATE POLICY fiscal_artifacts_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fiscal-artifacts'
    AND public.has_permission(
      auth.uid(),
      NULLIF((storage.foldername(name))[1], '')::uuid,
      'fiscal.manage'
    )
  );

DROP POLICY IF EXISTS fiscal_artifacts_delete ON storage.objects;
CREATE POLICY fiscal_artifacts_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'fiscal-artifacts'
    AND public.has_permission(
      auth.uid(),
      NULLIF((storage.foldername(name))[1], '')::uuid,
      'fiscal.manage'
    )
  );

-- 5) fiscal-certificates — bloqueia acesso direto (frontend nunca lê)
DROP POLICY IF EXISTS fiscal_certificates_bucket_deny_select ON storage.objects;
CREATE POLICY fiscal_certificates_bucket_deny_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id <> 'fiscal-certificates');

DROP POLICY IF EXISTS fiscal_certificates_bucket_deny_write ON storage.objects;
CREATE POLICY fiscal_certificates_bucket_deny_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id <> 'fiscal-certificates');

DROP POLICY IF EXISTS fiscal_certificates_bucket_deny_update ON storage.objects;
CREATE POLICY fiscal_certificates_bucket_deny_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id <> 'fiscal-certificates')
  WITH CHECK (bucket_id <> 'fiscal-certificates');

DROP POLICY IF EXISTS fiscal_certificates_bucket_deny_delete ON storage.objects;
CREATE POLICY fiscal_certificates_bucket_deny_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id <> 'fiscal-certificates');
