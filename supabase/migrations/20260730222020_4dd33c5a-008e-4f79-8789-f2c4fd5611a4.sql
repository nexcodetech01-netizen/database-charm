ALTER TABLE public.fiscal_documents
  ADD COLUMN IF NOT EXISTS xml_cancellation_path text,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid;