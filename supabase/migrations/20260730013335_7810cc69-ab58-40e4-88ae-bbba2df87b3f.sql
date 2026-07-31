
-- 1) Unicidade só para números efetivamente ocupados
ALTER TABLE public.fiscal_documents
  DROP CONSTRAINT IF EXISTS fiscal_documents_company_id_model_series_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS fiscal_documents_number_unique_idx
  ON public.fiscal_documents (company_id, model, series, number)
  WHERE number IS NOT NULL;

-- 2) Libera números presos em documentos que nunca chegaram à SEFAZ
UPDATE public.fiscal_documents
   SET number = NULL
 WHERE number IS NOT NULL
   AND access_key IS NULL
   AND status IN ('draft','validating','signing','sending','rejected','error');

-- 3) Alocação transacional de número
CREATE OR REPLACE FUNCTION public.fiscal_allocate_nfe_number(
  _company_id uuid,
  _document_id uuid,
  _model text DEFAULT '55',
  _series integer DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _settings_next integer;
  _series_eff integer;
  _max_used integer;
  _number integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.fiscal_documents d
     WHERE d.id = _document_id AND d.company_id = _company_id
  ) THEN
    RAISE EXCEPTION 'Documento fiscal não encontrado para a empresa.';
  END IF;

  -- Lock da linha de configuração: serializa emissões concorrentes da empresa.
  SELECT nfe_next_number, nfe_series
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

  UPDATE public.fiscal_settings
     SET nfe_next_number = _number + 1
   WHERE company_id = _company_id;

  RETURN _number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fiscal_allocate_nfe_number(uuid, uuid, text, integer) TO authenticated, service_role;

-- 4) Liberação do número quando a nota não foi autorizada
CREATE OR REPLACE FUNCTION public.fiscal_release_nfe_number(
  _company_id uuid,
  _document_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  UPDATE public.fiscal_settings
     SET nfe_next_number = _doc.number
   WHERE company_id = _company_id
     AND nfe_next_number = _doc.number + 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fiscal_release_nfe_number(uuid, uuid) TO authenticated, service_role;

-- 5) Ressincroniza a sequência com o maior número realmente ocupado
UPDATE public.fiscal_settings s
   SET nfe_next_number = GREATEST(
     s.nfe_next_number,
     COALESCE((
       SELECT MAX(d.number) + 1
         FROM public.fiscal_documents d
        WHERE d.company_id = s.company_id
          AND d.series = s.nfe_series
          AND d.number IS NOT NULL
     ), 1)
   );
