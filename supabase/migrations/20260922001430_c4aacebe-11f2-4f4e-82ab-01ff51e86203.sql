CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.current_company_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_tenant_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_tenant_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_tenant_id() TO service_role;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO service_role;

CREATE TABLE public.company_brand_kit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  logo_url text,
  primary_color text,
  secondary_color text,
  font_family text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_brand_kit_primary_color_hex_check
    CHECK (primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT company_brand_kit_secondary_color_hex_check
    CHECK (secondary_color IS NULL OR secondary_color ~ '^#[0-9A-Fa-f]{6}$')
);

GRANT SELECT, INSERT, UPDATE ON public.company_brand_kit TO authenticated;
GRANT ALL ON public.company_brand_kit TO service_role;

ALTER TABLE public.company_brand_kit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_brand_kit_select_own_tenant"
ON public.company_brand_kit
FOR SELECT
TO authenticated
USING (company_id = public.get_my_tenant_id());

CREATE POLICY "company_brand_kit_insert_own_tenant"
ON public.company_brand_kit
FOR INSERT
TO authenticated
WITH CHECK (company_id = public.get_my_tenant_id());

CREATE POLICY "company_brand_kit_update_own_tenant"
ON public.company_brand_kit
FOR UPDATE
TO authenticated
USING (company_id = public.get_my_tenant_id())
WITH CHECK (company_id = public.get_my_tenant_id());

CREATE TRIGGER company_brand_kit_set_updated_at
BEFORE UPDATE ON public.company_brand_kit
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.video_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text,
  creatomate_template_id text NOT NULL,
  aspect_ratio text,
  thumbnail_url text,
  active boolean NOT NULL DEFAULT true
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_templates TO authenticated;
GRANT ALL ON public.video_templates TO service_role;

ALTER TABLE public.video_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "video_templates_select_authenticated"
ON public.video_templates
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "video_templates_insert_admin"
ON public.video_templates
FOR INSERT
TO authenticated
WITH CHECK (public.is_platform_admin());

CREATE POLICY "video_templates_update_admin"
ON public.video_templates
FOR UPDATE
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

CREATE POLICY "video_templates_delete_admin"
ON public.video_templates
FOR DELETE
TO authenticated
USING (public.is_platform_admin());

CREATE TABLE public.video_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  template_id uuid NOT NULL REFERENCES public.video_templates(id) ON DELETE RESTRICT,
  requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending',
  input_payload jsonb,
  external_render_id text,
  output_video_url text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_jobs_status_check
    CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

GRANT SELECT, INSERT ON public.video_jobs TO authenticated;
GRANT ALL ON public.video_jobs TO service_role;

ALTER TABLE public.video_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "video_jobs_select_own_tenant"
ON public.video_jobs
FOR SELECT
TO authenticated
USING (company_id = public.get_my_tenant_id());

CREATE POLICY "video_jobs_insert_own_tenant"
ON public.video_jobs
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = public.get_my_tenant_id()
  AND requested_by = auth.uid()
  AND (
    product_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_id
        AND p.company_id = public.get_my_tenant_id()
    )
  )
);

CREATE INDEX video_jobs_company_created_at_idx
ON public.video_jobs (company_id, created_at DESC);

CREATE INDEX video_jobs_company_status_idx
ON public.video_jobs (company_id, status);

CREATE INDEX video_jobs_external_render_id_idx
ON public.video_jobs (external_render_id)
WHERE external_render_id IS NOT NULL;

CREATE TRIGGER video_jobs_set_updated_at
BEFORE UPDATE ON public.video_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();