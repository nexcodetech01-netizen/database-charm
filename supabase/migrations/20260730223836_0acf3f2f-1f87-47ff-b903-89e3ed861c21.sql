ALTER TABLE public.fiscal_documents
  ADD COLUMN IF NOT EXISTS artifacts_pending text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS artifacts_last_error text,
  ADD COLUMN IF NOT EXISTS artifacts_checked_at timestamptz;

CREATE INDEX IF NOT EXISTS fiscal_documents_artifacts_pending_idx
  ON public.fiscal_documents (company_id)
  WHERE array_length(artifacts_pending, 1) > 0;