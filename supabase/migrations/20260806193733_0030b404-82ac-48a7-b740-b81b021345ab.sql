ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ml_status TEXT DEFAULT 'draft';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ml_item_id TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ml_permalink TEXT;
NOTIFY pgrst, 'reload schema;';