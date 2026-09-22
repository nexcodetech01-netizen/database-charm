DROP POLICY IF EXISTS "video_jobs_select_own_tenant" ON public.video_jobs;
DROP POLICY IF EXISTS "video_jobs_insert_own_tenant" ON public.video_jobs;

DROP TRIGGER IF EXISTS video_jobs_set_updated_at ON public.video_jobs;

DROP INDEX IF EXISTS public.video_jobs_company_created_at_idx;
DROP INDEX IF EXISTS public.video_jobs_company_status_idx;
DROP INDEX IF EXISTS public.video_jobs_external_render_id_idx;

DROP TABLE public.video_jobs;

DROP POLICY IF EXISTS "video_templates_select_authenticated" ON public.video_templates;
DROP POLICY IF EXISTS "video_templates_insert_admin" ON public.video_templates;
DROP POLICY IF EXISTS "video_templates_update_admin" ON public.video_templates;
DROP POLICY IF EXISTS "video_templates_delete_admin" ON public.video_templates;

DROP TABLE public.video_templates;

DROP POLICY IF EXISTS "company_brand_kit_select_own_tenant" ON public.company_brand_kit;
DROP POLICY IF EXISTS "company_brand_kit_insert_own_tenant" ON public.company_brand_kit;
DROP POLICY IF EXISTS "company_brand_kit_update_own_tenant" ON public.company_brand_kit;

DROP TRIGGER IF EXISTS company_brand_kit_set_updated_at ON public.company_brand_kit;

DROP TABLE public.company_brand_kit;

DROP FUNCTION public.get_my_tenant_id();
DROP FUNCTION public.is_platform_admin();