ALTER TABLE public.shopping_list_items
  ADD COLUMN IF NOT EXISTS estimated_price numeric NULL,
  ADD COLUMN IF NOT EXISTS category text NULL;