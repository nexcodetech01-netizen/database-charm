
-- =========================
-- 1) TABLES
-- =========================
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_read_authenticated" ON public.roles FOR SELECT TO authenticated USING (true);

CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permissions_read_authenticated" ON public.permissions FOR SELECT TO authenticated USING (true);

CREATE TABLE public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_permissions_read_authenticated" ON public.role_permissions FOR SELECT TO authenticated USING (true);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id, role_id)
);
CREATE INDEX idx_user_roles_user_company ON public.user_roles(user_id, company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_roles_select_self_or_owner" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.user_owns_company(company_id)
  );

CREATE POLICY "user_roles_insert_owner" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.user_owns_company(company_id));

CREATE POLICY "user_roles_update_owner" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.user_owns_company(company_id))
  WITH CHECK (public.user_owns_company(company_id));

CREATE POLICY "user_roles_delete_owner" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.user_owns_company(company_id));

-- =========================
-- 2) has_permission()
-- =========================
CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id UUID,
  _company_id UUID,
  _permission_code TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.companies
      WHERE id = _company_id AND owner_id = _user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = _user_id
        AND ur.company_id = _company_id
        AND p.code = _permission_code
    );
$$;

REVOKE EXECUTE ON FUNCTION public.has_permission(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permission(UUID, UUID, TEXT) TO authenticated, service_role;

-- =========================
-- 3) SEED — permissions
-- =========================
INSERT INTO public.permissions (code, module, action, description)
SELECT m || '.' || a, m, a,
       initcap(a) || ' ' || m
FROM unnest(ARRAY[
  'dashboard','products','categories','purchases','inventory','suppliers',
  'customers','crm','agenda','sales','finance','bella_pay','reports',
  'marketing','bella_ia','settings'
]) AS m
CROSS JOIN unnest(ARRAY['view','create','update','delete','export']) AS a;

-- =========================
-- 4) SEED — roles
-- =========================
INSERT INTO public.roles (name, description, is_system) VALUES
  ('owner',         'Proprietário — acesso total',                     true),
  ('admin',         'Administrador — acesso quase total',              true),
  ('gerente',       'Gerente operacional',                             true),
  ('financeiro',    'Time financeiro',                                 true),
  ('estoque',       'Time de estoque e compras',                       true),
  ('vendas',        'Time comercial',                                  true),
  ('marketing',     'Time de marketing',                               true),
  ('atendimento',   'Atendimento e agenda',                            true),
  ('visualizador',  'Somente leitura e exportação',                    true);

-- =========================
-- 5) SEED — role_permissions
-- =========================

-- owner: tudo
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r CROSS JOIN public.permissions p
WHERE r.name = 'owner';

-- admin: tudo, exceto settings.delete
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r CROSS JOIN public.permissions p
WHERE r.name = 'admin' AND p.code <> 'settings.delete';

-- visualizador: view + export em todos os módulos
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r CROSS JOIN public.permissions p
WHERE r.name = 'visualizador' AND p.action IN ('view','export');

-- Matriz genérica para papéis específicos
WITH matrix(role_name, module, action) AS (
  VALUES
  -- gerente
  ('gerente','dashboard','view'),('gerente','dashboard','export'),
  ('gerente','products','view'),('gerente','products','create'),('gerente','products','update'),('gerente','products','export'),
  ('gerente','categories','view'),('gerente','categories','create'),('gerente','categories','update'),('gerente','categories','export'),
  ('gerente','purchases','view'),('gerente','purchases','create'),('gerente','purchases','update'),('gerente','purchases','export'),
  ('gerente','inventory','view'),('gerente','inventory','create'),('gerente','inventory','update'),('gerente','inventory','export'),
  ('gerente','suppliers','view'),('gerente','suppliers','create'),('gerente','suppliers','update'),('gerente','suppliers','export'),
  ('gerente','customers','view'),('gerente','customers','create'),('gerente','customers','update'),('gerente','customers','export'),
  ('gerente','crm','view'),('gerente','crm','create'),('gerente','crm','update'),('gerente','crm','export'),
  ('gerente','agenda','view'),('gerente','agenda','create'),('gerente','agenda','update'),('gerente','agenda','export'),
  ('gerente','sales','view'),('gerente','sales','create'),('gerente','sales','update'),('gerente','sales','export'),
  ('gerente','finance','view'),('gerente','finance','export'),
  ('gerente','reports','view'),('gerente','reports','export'),
  ('gerente','marketing','view'),('gerente','marketing','create'),('gerente','marketing','update'),('gerente','marketing','export'),
  ('gerente','bella_ia','view'),

  -- financeiro
  ('financeiro','dashboard','view'),('financeiro','dashboard','export'),
  ('financeiro','finance','view'),('financeiro','finance','create'),('financeiro','finance','update'),('financeiro','finance','delete'),('financeiro','finance','export'),
  ('financeiro','bella_pay','view'),('financeiro','bella_pay','create'),('financeiro','bella_pay','update'),('financeiro','bella_pay','delete'),('financeiro','bella_pay','export'),
  ('financeiro','reports','view'),('financeiro','reports','export'),
  ('financeiro','sales','view'),('financeiro','sales','export'),
  ('financeiro','purchases','view'),('financeiro','purchases','export'),
  ('financeiro','customers','view'),
  ('financeiro','suppliers','view'),

  -- estoque
  ('estoque','dashboard','view'),
  ('estoque','products','view'),('estoque','products','create'),('estoque','products','update'),('estoque','products','delete'),('estoque','products','export'),
  ('estoque','categories','view'),('estoque','categories','create'),('estoque','categories','update'),('estoque','categories','delete'),('estoque','categories','export'),
  ('estoque','inventory','view'),('estoque','inventory','create'),('estoque','inventory','update'),('estoque','inventory','delete'),('estoque','inventory','export'),
  ('estoque','purchases','view'),('estoque','purchases','create'),('estoque','purchases','update'),('estoque','purchases','export'),
  ('estoque','suppliers','view'),('estoque','suppliers','create'),('estoque','suppliers','update'),('estoque','suppliers','export'),
  ('estoque','reports','view'),('estoque','reports','export'),

  -- vendas
  ('vendas','dashboard','view'),
  ('vendas','sales','view'),('vendas','sales','create'),('vendas','sales','update'),('vendas','sales','export'),
  ('vendas','customers','view'),('vendas','customers','create'),('vendas','customers','update'),('vendas','customers','export'),
  ('vendas','crm','view'),('vendas','crm','create'),('vendas','crm','update'),('vendas','crm','export'),
  ('vendas','agenda','view'),('vendas','agenda','create'),('vendas','agenda','update'),('vendas','agenda','export'),
  ('vendas','products','view'),
  ('vendas','reports','view'),('vendas','reports','export'),

  -- marketing
  ('marketing','dashboard','view'),
  ('marketing','marketing','view'),('marketing','marketing','create'),('marketing','marketing','update'),('marketing','marketing','delete'),('marketing','marketing','export'),
  ('marketing','crm','view'),('marketing','crm','create'),('marketing','crm','update'),('marketing','crm','export'),
  ('marketing','customers','view'),('marketing','customers','export'),
  ('marketing','reports','view'),('marketing','reports','export'),
  ('marketing','bella_ia','view'),

  -- atendimento
  ('atendimento','dashboard','view'),
  ('atendimento','agenda','view'),('atendimento','agenda','create'),('atendimento','agenda','update'),('atendimento','agenda','export'),
  ('atendimento','customers','view'),('atendimento','customers','update'),('atendimento','customers','export'),
  ('atendimento','sales','view'),
  ('atendimento','crm','view')
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM matrix m
JOIN public.roles r ON r.name = m.role_name
JOIN public.permissions p ON p.module = m.module AND p.action = m.action
ON CONFLICT DO NOTHING;
