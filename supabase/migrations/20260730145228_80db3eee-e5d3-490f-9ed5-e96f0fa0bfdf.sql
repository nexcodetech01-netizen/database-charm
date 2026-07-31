-- 1) Dedupe: mantém apenas o registro mais recente por (company_id, kind, owner_id)
DELETE FROM public.fiscal_secrets s
USING public.fiscal_secrets s2
WHERE s.company_id = s2.company_id
  AND s.kind = s2.kind
  AND s.owner_id IS NOT DISTINCT FROM s2.owner_id
  AND (s.updated_at, s.id) < (s2.updated_at, s2.id);

-- 2) Unicidade tratando NULL como valor (owner_id nulo = chave do provedor)
ALTER TABLE public.fiscal_secrets
  DROP CONSTRAINT IF EXISTS fiscal_secrets_company_id_kind_owner_id_key;
DROP INDEX IF EXISTS public.fiscal_secrets_company_id_kind_owner_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS fiscal_secrets_company_kind_owner_uidx
  ON public.fiscal_secrets (company_id, kind, owner_id) NULLS NOT DISTINCT;

-- 3) Gravação determinística (delete + insert), independente de ON CONFLICT
CREATE OR REPLACE FUNCTION public.fiscal_set_secret(
  _company_id uuid,
  _kind text,
  _owner_id uuid,
  _ciphertext bytea
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.has_permission(_uid, _company_id, 'fiscal.manage') THEN
    RAISE EXCEPTION 'forbidden: fiscal.manage required';
  END IF;

  DELETE FROM public.fiscal_secrets
   WHERE company_id = _company_id
     AND kind = _kind
     AND (owner_id IS NOT DISTINCT FROM _owner_id);

  IF _ciphertext IS NULL OR octet_length(_ciphertext) = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.fiscal_secrets (company_id, kind, owner_id, ciphertext, updated_by)
  VALUES (_company_id, _kind, _owner_id, _ciphertext, _uid);
END;
$function$;