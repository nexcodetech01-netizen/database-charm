
-- P2.4 — Fuso horário por empresa
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

CREATE OR REPLACE FUNCTION public.company_timezone(_company_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(TRIM(timezone), ''), 'America/Sao_Paulo')
    FROM public.companies WHERE id = _company_id
$$;

CREATE OR REPLACE FUNCTION public.company_today(_company_id uuid)
RETURNS date
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT (now() AT TIME ZONE public.company_timezone(_company_id))::date
   WHERE public.user_has_company_access(_company_id)
$$;

CREATE OR REPLACE FUNCTION public.company_month_start(_company_id uuid)
RETURNS date
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT date_trunc('month', (now() AT TIME ZONE public.company_timezone(_company_id)))::date
   WHERE public.user_has_company_access(_company_id)
$$;

REVOKE ALL ON FUNCTION public.company_today(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.company_month_start(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.company_timezone(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.company_today(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_month_start(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_timezone(uuid) TO authenticated;

-- P2.3 — Auditoria de eventos de venda (cancelamento + futuros)
CREATE TABLE IF NOT EXISTS public.sale_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID,
  event_type TEXT NOT NULL,
  reason TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sale_events_sale_id_idx ON public.sale_events(sale_id);
CREATE INDEX IF NOT EXISTS sale_events_company_created_idx
  ON public.sale_events(company_id, created_at DESC);

GRANT SELECT, INSERT ON public.sale_events TO authenticated;
GRANT ALL ON public.sale_events TO service_role;

ALTER TABLE public.sale_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sale_events_select_company" ON public.sale_events;
CREATE POLICY "sale_events_select_company"
  ON public.sale_events FOR SELECT
  TO authenticated
  USING (public.user_has_company_access(company_id));

-- Inserção somente via RPCs SECURITY DEFINER (cancel_sale etc.). Nada de
-- INSERT direto do cliente para não permitir forjar auditoria.
DROP POLICY IF EXISTS "sale_events_no_direct_insert" ON public.sale_events;
CREATE POLICY "sale_events_no_direct_insert"
  ON public.sale_events FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- cancel_sale passa a aceitar motivo opcional e grava evento de auditoria.
CREATE OR REPLACE FUNCTION public.cancel_sale(_sale_id uuid, _reason text DEFAULT NULL)
RETURNS public.sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_sale public.sales%ROWTYPE;
  v_reason text := NULLIF(TRIM(COALESCE(_reason, '')), '');
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sales s
     WHERE s.id = _sale_id
       AND public.user_has_company_access(s.company_id)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para cancelar esta venda.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO current_sale
    FROM public.sales
   WHERE id = _sale_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada.';
  END IF;

  IF current_sale.status = 'cancelled' THEN
    RETURN current_sale;
  END IF;

  IF current_sale.status NOT IN ('draft', 'pending', 'paid') THEN
    RAISE EXCEPTION 'A venda no status % não pode ser cancelada.', current_sale.status;
  END IF;

  UPDATE public.sales
     SET status = 'cancelled'
   WHERE id = _sale_id
   RETURNING * INTO current_sale;

  INSERT INTO public.sale_events(
    sale_id, company_id, user_id, event_type, reason, payload
  ) VALUES (
    current_sale.id, current_sale.company_id, auth.uid(),
    'sale_cancelled', v_reason,
    jsonb_build_object(
      'previous_status', 'paid_or_pending',
      'grand_total', current_sale.grand_total,
      'sale_number', current_sale.number
    )
  );

  RETURN current_sale;
END;
$function$;

-- Mantém a assinatura antiga (1 argumento) para compatibilidade com callers
-- que ainda não passam o motivo. Delega para a nova assinatura.
CREATE OR REPLACE FUNCTION public.cancel_sale(_sale_id uuid)
RETURNS public.sales
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM public.cancel_sale(_sale_id, NULL::text)
$$;

REVOKE ALL ON FUNCTION public.cancel_sale(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_sale(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid) TO authenticated;
