-- Métricas do catálogo público (26/10/2026): visitas, peças vistas e cliques
-- no WhatsApp. Gravado só pelo servidor (/api/public/catalog/track, service
-- role); a loja só lê os próprios números.
CREATE TABLE IF NOT EXISTS public.catalog_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  collection_id uuid REFERENCES public.product_collections(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('collection_view', 'product_view', 'whatsapp_click')),
  visitor_id text NOT NULL CHECK (length(visitor_id) BETWEEN 8 AND 64),
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS catalog_events_company_created_idx
  ON public.catalog_events (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS catalog_events_dedupe_idx
  ON public.catalog_events (visitor_id, event_type, product_id, created_at DESC);

ALTER TABLE public.catalog_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_events_select" ON public.catalog_events;
CREATE POLICY "catalog_events_select" ON public.catalog_events
  FOR SELECT USING (public.user_has_company_access(company_id));
-- Sem política de INSERT/UPDATE/DELETE: só o servidor grava.

CREATE OR REPLACE FUNCTION public.catalog_stats(_company_id uuid, _days int DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(_days, 7), 365)));
  result jsonb;
BEGIN
  IF NOT public.user_has_company_access(_company_id) THEN
    RAISE EXCEPTION 'Sem acesso à empresa.';
  END IF;

  WITH ev AS (
    SELECT * FROM public.catalog_events
     WHERE company_id = _company_id AND created_at >= since
  ),
  daily AS (
    SELECT (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day,
           count(DISTINCT visitor_id) AS visitors,
           count(*) FILTER (WHERE event_type = 'product_view') AS product_views,
           count(*) FILTER (WHERE event_type = 'whatsapp_click') AS whatsapp_clicks
      FROM ev GROUP BY 1
  ),
  top AS (
    SELECT e.product_id, p.name,
           count(*) FILTER (WHERE e.event_type = 'product_view') AS views,
           count(*) FILTER (WHERE e.event_type = 'whatsapp_click') AS clicks
      FROM ev e JOIN public.products p ON p.id = e.product_id
     WHERE e.product_id IS NOT NULL
     GROUP BY e.product_id, p.name
     ORDER BY views DESC, clicks DESC
     LIMIT 10
  )
  SELECT jsonb_build_object(
    'visitors', (SELECT count(DISTINCT visitor_id) FROM ev),
    'product_views', (SELECT count(*) FROM ev WHERE event_type = 'product_view'),
    'whatsapp_clicks', (SELECT count(*) FROM ev WHERE event_type = 'whatsapp_click'),
    'daily', coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.day) FROM daily d), '[]'::jsonb),
    'top_products', coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM top t), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.catalog_stats(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalog_stats(uuid, int) TO authenticated, service_role;
