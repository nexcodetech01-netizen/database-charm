
-- Drop previous helper (not needed anymore) and recreate fiscal_set_secret
DROP FUNCTION IF EXISTS public.fiscal_set_secret(uuid, text, uuid, text);
DROP FUNCTION IF EXISTS public._fiscal_secrets_key();

CREATE OR REPLACE FUNCTION public.fiscal_set_secret(
  _company_id uuid,
  _kind text,
  _owner_id uuid,
  _ciphertext bytea
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.has_permission(_uid, _company_id, 'fiscal.manage') THEN
    RAISE EXCEPTION 'forbidden: fiscal.manage required';
  END IF;

  IF _ciphertext IS NULL OR octet_length(_ciphertext) = 0 THEN
    DELETE FROM public.fiscal_secrets
     WHERE company_id = _company_id
       AND kind = _kind
       AND (owner_id IS NOT DISTINCT FROM _owner_id);
    RETURN;
  END IF;

  INSERT INTO public.fiscal_secrets (company_id, kind, owner_id, ciphertext, updated_by)
  VALUES (_company_id, _kind, _owner_id, _ciphertext, _uid)
  ON CONFLICT (company_id, kind, owner_id) DO UPDATE
    SET ciphertext = EXCLUDED.ciphertext,
        updated_at = now(),
        updated_by = _uid;
END;
$$;

REVOKE ALL ON FUNCTION public.fiscal_set_secret(uuid, text, uuid, bytea) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fiscal_set_secret(uuid, text, uuid, bytea) TO authenticated;

-- Harden previously created SECURITY DEFINER functions (revoke from anon)
REVOKE EXECUTE ON FUNCTION public.fiscal_has_secret(uuid, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fiscal_delete_certificate(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fiscal_record_provider_health(uuid, text, text) FROM anon;
