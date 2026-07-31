ALTER TABLE public.fiscal_documents
  ADD COLUMN IF NOT EXISTS discarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS discarded_by uuid,
  ADD COLUMN IF NOT EXISTS discard_reason text;

ALTER TABLE public.fiscal_documents DROP CONSTRAINT IF EXISTS fiscal_documents_status_check;
ALTER TABLE public.fiscal_documents ADD CONSTRAINT fiscal_documents_status_check
  CHECK (status = ANY (ARRAY['draft','validating','signing','sending','authorized','rejected','cancelled','error','discarded']));

CREATE INDEX IF NOT EXISTS idx_fiscal_documents_sale_active
  ON public.fiscal_documents (sale_id, created_at DESC)
  WHERE status <> 'discarded';