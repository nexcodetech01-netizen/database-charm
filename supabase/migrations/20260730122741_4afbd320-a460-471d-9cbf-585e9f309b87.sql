-- 1) Histórico de execuções de jobs
CREATE TABLE IF NOT EXISTS public.job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_runs_status_check CHECK (status IN ('running','success','error'))
);

CREATE INDEX IF NOT EXISTS idx_job_runs_name_started ON public.job_runs (job_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_runs_started ON public.job_runs (started_at DESC);

GRANT SELECT ON public.job_runs TO authenticated;
GRANT ALL ON public.job_runs TO service_role;

ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_platform_health(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id
      AND p.code IN ('settings.view','settings.update')
  );
$$;

DROP POLICY IF EXISTS "Platform admins can read job runs" ON public.job_runs;
CREATE POLICY "Platform admins can read job runs"
ON public.job_runs
FOR SELECT
TO authenticated
USING (public.can_view_platform_health(auth.uid()));

-- 2) Agendador
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.schedule_nexos_jobs(_base_url text, _secret text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, net
AS $$
DECLARE
  v_headers jsonb;
  v_jobs jsonb := '[]'::jsonb;
  v_def record;
BEGIN
  IF _base_url IS NULL OR _base_url = '' THEN
    RAISE EXCEPTION 'base_url obrigatória';
  END IF;
  IF _secret IS NULL OR length(_secret) < 16 THEN
    RAISE EXCEPTION 'secret ausente ou fraco (mínimo 16 caracteres)';
  END IF;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || _secret
  );

  FOR v_def IN
    SELECT * FROM (VALUES
      ('nexos-mercadolivre-refresh', '0 */6 * * *',  '/api/public/jobs/mercadolivre-refresh'),
      ('nexos-dlq-reprocess',        '*/15 * * * *', '/api/public/jobs/dlq-reprocess'),
      ('nexos-mercadolivre-reconcile','*/30 * * * *','/api/public/jobs/mercadolivre-reconcile'),
      ('nexos-health',               '*/10 * * * *', '/api/public/jobs/health')
    ) AS t(job_name, schedule, path)
  LOOP
    PERFORM cron.unschedule(v_def.job_name)
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = v_def.job_name);

    PERFORM cron.schedule(
      v_def.job_name,
      v_def.schedule,
      format(
        $cmd$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb) AS request_id;$cmd$,
        rtrim(_base_url, '/') || v_def.path,
        v_headers::text
      )
    );

    v_jobs := v_jobs || jsonb_build_object('job', v_def.job_name, 'schedule', v_def.schedule);
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'scheduled', v_jobs);
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_nexos_jobs(text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_nexos_jobs(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.nexos_jobs_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, cron
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'job_name', j.jobname,
    'schedule', j.schedule,
    'active', j.active
  ) ORDER BY j.jobname), '[]'::jsonb)
  FROM cron.job j
  WHERE j.jobname LIKE 'nexos-%';
$$;

REVOKE ALL ON FUNCTION public.nexos_jobs_status() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.nexos_jobs_status() TO authenticated, service_role;