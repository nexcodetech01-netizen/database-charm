CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  user_id uuid,
  ip text,
  user_agent text,
  correlation_id text,
  action text NOT NULL,
  module text NOT NULL,
  resource_table text,
  resource_id text,
  before_value jsonb,
  after_value jsonb,
  result text NOT NULL DEFAULT 'success',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_audit_log
  ADD CONSTRAINT security_audit_log_result_check
  CHECK (result IN ('success','denied','error'));

CREATE INDEX IF NOT EXISTS idx_security_audit_company_created
  ON public.security_audit_log (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_user_created
  ON public.security_audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_resource
  ON public.security_audit_log (resource_table, resource_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_result
  ON public.security_audit_log (result, created_at DESC);

GRANT SELECT ON public.security_audit_log TO authenticated;
GRANT ALL ON public.security_audit_log TO service_role;

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_read_settings_view"
  ON public.security_audit_log
  FOR SELECT
  TO authenticated
  USING (
    company_id IS NOT NULL
    AND public.user_has_company_access(company_id)
    AND public.has_permission(auth.uid(), company_id, 'settings.view')
  );

CREATE OR REPLACE FUNCTION public.log_security_audit(
  _company_id uuid,
  _action text,
  _module text,
  _resource_table text DEFAULT NULL,
  _resource_id text DEFAULT NULL,
  _before jsonb DEFAULT NULL,
  _after jsonb DEFAULT NULL,
  _result text DEFAULT 'success',
  _error text DEFAULT NULL,
  _ip text DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _correlation_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  INSERT INTO public.security_audit_log (
    company_id, user_id, ip, user_agent, correlation_id,
    action, module, resource_table, resource_id,
    before_value, after_value, result, error
  ) VALUES (
    _company_id, auth.uid(), _ip, _user_agent, _correlation_id,
    _action, _module, _resource_table, _resource_id,
    _before, _after,
    CASE WHEN _result IN ('success','denied','error') THEN _result ELSE 'error' END,
    _error
  )
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_security_audit(uuid,text,text,text,text,jsonb,jsonb,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_security_audit(uuid,text,text,text,text,jsonb,jsonb,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_security_audit(uuid,text,text,text,text,jsonb,jsonb,text,text,text,text,text) TO service_role;