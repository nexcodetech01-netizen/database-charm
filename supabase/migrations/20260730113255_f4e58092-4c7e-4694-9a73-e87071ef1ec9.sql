-- 1) Idempotência de movimentos de estoque vindos de integrações externas
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_external_reference
  ON public.inventory_movements (company_id, product_id, source, reference_number)
  WHERE source IS NOT NULL
    AND reference_number IS NOT NULL
    AND source IN ('mercadolivre', 'shopify', 'webhook', 'integration');

-- 2) Dead Letter Queue para integrações externas
CREATE TABLE IF NOT EXISTS public.integration_dead_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  source text NOT NULL,
  topic text,
  reference text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  attempts integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  last_attempt_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT integration_dead_letters_status_check
    CHECK (status IN ('pending', 'retrying', 'resolved', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_integration_dead_letters_pending
  ON public.integration_dead_letters (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_dead_letters_company
  ON public.integration_dead_letters (company_id, created_at DESC);

GRANT SELECT ON public.integration_dead_letters TO authenticated;
GRANT ALL ON public.integration_dead_letters TO service_role;

ALTER TABLE public.integration_dead_letters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dlq_select_company" ON public.integration_dead_letters;
CREATE POLICY "dlq_select_company"
  ON public.integration_dead_letters FOR SELECT TO authenticated
  USING (company_id IS NOT NULL AND public.has_permission(auth.uid(), company_id, 'settings.view'));

DROP TRIGGER IF EXISTS trg_integration_dead_letters_touch ON public.integration_dead_letters;
CREATE TRIGGER trg_integration_dead_letters_touch
  BEFORE UPDATE ON public.integration_dead_letters
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();