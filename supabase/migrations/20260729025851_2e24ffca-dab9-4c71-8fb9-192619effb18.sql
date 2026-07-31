-- ==========================================================
-- Sprint 007 — Módulo Fiscal (NF-e)
-- ==========================================================

-- 1) fiscal_documents ---------------------------------------
CREATE TABLE public.fiscal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,

  doc_type text NOT NULL DEFAULT 'nfe' CHECK (doc_type IN ('nfe','nfce','nfse')),
  model text NOT NULL DEFAULT '55',
  series integer,
  number integer,
  access_key text,

  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','validating','signing','sending','authorized','rejected','cancelled','error')),
  provider text NOT NULL DEFAULT 'mock',
  environment text NOT NULL DEFAULT 'homolog' CHECK (environment IN ('homolog','production')),

  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  operation_nature text,
  cfop text,

  xml_signed_path text,
  xml_authorized_path text,
  danfe_path text,
  protocol text,
  protocol_at timestamptz,

  rejection_code text,
  rejection_reason text,

  cancelled_at timestamptz,
  cancellation_reason text,
  cancellation_protocol text,

  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (company_id, model, series, number),
  UNIQUE (company_id, access_key)
);

CREATE INDEX idx_fiscal_documents_company_status ON public.fiscal_documents(company_id, status);
CREATE INDEX idx_fiscal_documents_sale ON public.fiscal_documents(sale_id);
CREATE INDEX idx_fiscal_documents_customer ON public.fiscal_documents(customer_id);
CREATE INDEX idx_fiscal_documents_created_at ON public.fiscal_documents(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_documents TO authenticated;
GRANT ALL ON public.fiscal_documents TO service_role;
ALTER TABLE public.fiscal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_documents_select"
  ON public.fiscal_documents FOR SELECT TO authenticated
  USING (public.user_has_company_access(company_id) AND public.has_permission(auth.uid(), company_id, 'fiscal.view'));

CREATE POLICY "fiscal_documents_insert"
  ON public.fiscal_documents FOR INSERT TO authenticated
  WITH CHECK (public.user_has_company_access(company_id) AND public.has_permission(auth.uid(), company_id, 'fiscal.create'));

CREATE POLICY "fiscal_documents_update"
  ON public.fiscal_documents FOR UPDATE TO authenticated
  USING (public.user_has_company_access(company_id) AND public.has_permission(auth.uid(), company_id, 'fiscal.update'))
  WITH CHECK (public.user_has_company_access(company_id) AND public.has_permission(auth.uid(), company_id, 'fiscal.update'));

CREATE POLICY "fiscal_documents_delete"
  ON public.fiscal_documents FOR DELETE TO authenticated
  USING (public.user_has_company_access(company_id) AND public.has_permission(auth.uid(), company_id, 'fiscal.delete'));

-- 2) fiscal_events ------------------------------------------
CREATE TABLE public.fiscal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.fiscal_documents(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type IN ('created','validated','signed','sent','authorized','rejected','cancelled','error','reissued')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fiscal_events_document ON public.fiscal_events(document_id, created_at DESC);
CREATE INDEX idx_fiscal_events_company ON public.fiscal_events(company_id, created_at DESC);

GRANT SELECT, INSERT ON public.fiscal_events TO authenticated;
GRANT ALL ON public.fiscal_events TO service_role;
ALTER TABLE public.fiscal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_events_select"
  ON public.fiscal_events FOR SELECT TO authenticated
  USING (public.user_has_company_access(company_id) AND public.has_permission(auth.uid(), company_id, 'fiscal.view'));

CREATE POLICY "fiscal_events_insert"
  ON public.fiscal_events FOR INSERT TO authenticated
  WITH CHECK (public.user_has_company_access(company_id) AND public.has_permission(auth.uid(), company_id, 'fiscal.create'));

-- 3) fiscal_certificates (metadados apenas) ------------------
CREATE TABLE public.fiscal_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  alias text NOT NULL,
  subject_name text,
  subject_cnpj text,
  issuer_name text,
  valid_from timestamptz,
  valid_to timestamptz,
  storage_path text,
  is_active boolean NOT NULL DEFAULT true,
  last_rotated_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (company_id, alias)
);

CREATE INDEX idx_fiscal_certificates_company_active ON public.fiscal_certificates(company_id, is_active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_certificates TO authenticated;
GRANT ALL ON public.fiscal_certificates TO service_role;
ALTER TABLE public.fiscal_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_certificates_select"
  ON public.fiscal_certificates FOR SELECT TO authenticated
  USING (public.user_has_company_access(company_id) AND public.has_permission(auth.uid(), company_id, 'fiscal.view'));

CREATE POLICY "fiscal_certificates_insert"
  ON public.fiscal_certificates FOR INSERT TO authenticated
  WITH CHECK (public.user_has_company_access(company_id) AND public.has_permission(auth.uid(), company_id, 'fiscal.create'));

CREATE POLICY "fiscal_certificates_update"
  ON public.fiscal_certificates FOR UPDATE TO authenticated
  USING (public.user_has_company_access(company_id) AND public.has_permission(auth.uid(), company_id, 'fiscal.update'))
  WITH CHECK (public.user_has_company_access(company_id) AND public.has_permission(auth.uid(), company_id, 'fiscal.update'));

CREATE POLICY "fiscal_certificates_delete"
  ON public.fiscal_certificates FOR DELETE TO authenticated
  USING (public.user_has_company_access(company_id) AND public.has_permission(auth.uid(), company_id, 'fiscal.delete'));

-- 4) updated_at trigger reutilizado
CREATE OR REPLACE FUNCTION public._touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_fiscal_documents_touch
  BEFORE UPDATE ON public.fiscal_documents
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

CREATE TRIGGER trg_fiscal_certificates_touch
  BEFORE UPDATE ON public.fiscal_certificates
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

-- 5) Seed RBAC — módulo fiscal
INSERT INTO public.permissions (code, module, action, description)
VALUES
  ('fiscal.view',   'fiscal', 'view',   'Visualizar documentos fiscais'),
  ('fiscal.create', 'fiscal', 'create', 'Emitir documentos fiscais'),
  ('fiscal.update', 'fiscal', 'update', 'Atualizar documentos fiscais'),
  ('fiscal.delete', 'fiscal', 'delete', 'Cancelar/excluir documentos fiscais'),
  ('fiscal.export', 'fiscal', 'export', 'Exportar XMLs/DANFEs')
ON CONFLICT (code) DO NOTHING;

-- Owner e admin recebem todas as fiscal.*
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.is_system = true
  AND r.name IN ('owner','admin')
  AND p.module = 'fiscal'
ON CONFLICT DO NOTHING;

-- Financeiro visualiza + exporta
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.is_system = true
  AND r.name = 'financeiro'
  AND p.code IN ('fiscal.view','fiscal.export')
ON CONFLICT DO NOTHING;