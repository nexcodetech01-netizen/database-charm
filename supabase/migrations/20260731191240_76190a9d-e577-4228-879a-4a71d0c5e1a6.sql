CREATE TABLE IF NOT EXISTS public.marketplace_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  marketplace text NOT NULL DEFAULT 'mercadolivre',
  reason text,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  last_attempt_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_sync_queue_status_check
    CHECK (status IN ('pending', 'processing', 'done', 'error'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_sync_queue_pending
  ON public.marketplace_sync_queue (product_id, marketplace)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_marketplace_sync_queue_pending
  ON public.marketplace_sync_queue (status, created_at);
CREATE INDEX IF NOT EXISTS idx_marketplace_sync_queue_company
  ON public.marketplace_sync_queue (company_id, created_at DESC);

GRANT SELECT ON public.marketplace_sync_queue TO authenticated;
GRANT ALL ON public.marketplace_sync_queue TO service_role;

ALTER TABLE public.marketplace_sync_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketplace_sync_queue_select_company" ON public.marketplace_sync_queue;
CREATE POLICY "marketplace_sync_queue_select_company"
  ON public.marketplace_sync_queue FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), company_id, 'settings.view'));

DROP TRIGGER IF EXISTS trg_marketplace_sync_queue_touch ON public.marketplace_sync_queue;
CREATE TRIGGER trg_marketplace_sync_queue_touch
  BEFORE UPDATE ON public.marketplace_sync_queue
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

-- Enfileiramento orientado a evento: qualquer alteração de estoque/preço de
-- um produto anunciado no Mercado Livre entra na fila. Nunca falha o UPDATE.
CREATE OR REPLACE FUNCTION public.enqueue_marketplace_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ml_item_id IS NULL OR NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.stock IS NOT DISTINCT FROM OLD.stock
     AND NEW.price IS NOT DISTINCT FROM OLD.price
     AND NEW.ml_item_id IS NOT DISTINCT FROM OLD.ml_item_id THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.marketplace_sync_queue (company_id, product_id, marketplace, reason)
    VALUES (NEW.company_id, NEW.id, 'mercadolivre', TG_OP)
    ON CONFLICT (product_id, marketplace) WHERE status IN ('pending', 'processing')
    DO UPDATE SET status = 'pending', updated_at = now();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'enqueue_marketplace_sync falhou para produto %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_marketplace_sync ON public.products;
CREATE TRIGGER trg_products_marketplace_sync
  AFTER INSERT OR UPDATE OF stock, price, ml_item_id ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_marketplace_sync();