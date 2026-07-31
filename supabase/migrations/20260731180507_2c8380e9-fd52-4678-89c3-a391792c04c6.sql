ALTER TABLE public.fiscal_settings
  ADD COLUMN IF NOT EXISTS nfce_series integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS nfce_next_number integer NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.fiscal_allocate_nfe_number(_company_id uuid, _document_id uuid, _model text DEFAULT '55'::text, _series integer DEFAULT NULL::integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _settings_next integer;
  _series_eff integer;
  _max_used integer;
  _number integer;
  _is_nfce boolean := (_model = '65');
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.fiscal_documents d
     WHERE d.id = _document_id AND d.company_id = _company_id
  ) THEN
    RAISE EXCEPTION 'Documento fiscal não encontrado para a empresa.';
  END IF;

  -- Lock da linha de configuração: serializa emissões concorrentes da empresa.
  SELECT CASE WHEN _is_nfce THEN nfce_next_number ELSE nfe_next_number END,
         CASE WHEN _is_nfce THEN nfce_series ELSE nfe_series END
    INTO _settings_next, _series_eff
    FROM public.fiscal_settings
   WHERE company_id = _company_id
   FOR UPDATE;

  IF _settings_next IS NULL THEN
    RAISE EXCEPTION 'Configuração fiscal não encontrada para a empresa.';
  END IF;

  _series_eff := COALESCE(_series, _series_eff, 1);

  SELECT MAX(number) INTO _max_used
    FROM public.fiscal_documents
   WHERE company_id = _company_id
     AND model = _model
     AND series = _series_eff
     AND number IS NOT NULL;

  _number := GREATEST(_settings_next, COALESCE(_max_used, 0) + 1);

  UPDATE public.fiscal_documents
     SET model = _model,
         series = _series_eff,
         number = _number
   WHERE id = _document_id
     AND company_id = _company_id;

  IF _is_nfce THEN
    UPDATE public.fiscal_settings
       SET nfce_next_number = _number + 1
     WHERE company_id = _company_id;
  ELSE
    UPDATE public.fiscal_settings
       SET nfe_next_number = _number + 1
     WHERE company_id = _company_id;
  END IF;

  RETURN _number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fiscal_release_nfe_number(_company_id uuid, _document_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _doc public.fiscal_documents;
BEGIN
  SELECT * INTO _doc
    FROM public.fiscal_documents
   WHERE id = _document_id AND company_id = _company_id
   FOR UPDATE;

  IF NOT FOUND OR _doc.number IS NULL THEN
    RETURN;
  END IF;

  -- Nunca mexer em documento que já existe na SEFAZ.
  IF _doc.status IN ('authorized','cancelled') OR _doc.access_key IS NOT NULL THEN
    RETURN;
  END IF;

  UPDATE public.fiscal_documents
     SET number = NULL
   WHERE id = _document_id;

  -- Devolve a sequência apenas se este era o último número emitido.
  IF _doc.model = '65' THEN
    UPDATE public.fiscal_settings
       SET nfce_next_number = _doc.number
     WHERE company_id = _company_id
       AND nfce_next_number = _doc.number + 1;
  ELSE
    UPDATE public.fiscal_settings
       SET nfe_next_number = _doc.number
     WHERE company_id = _company_id
       AND nfe_next_number = _doc.number + 1;
  END IF;
END;
$function$;