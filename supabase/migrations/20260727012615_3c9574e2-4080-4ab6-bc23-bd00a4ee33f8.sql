ALTER TABLE public.inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_source_check;

ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_source_check
  CHECK (
    source IS NULL OR source = ANY (ARRAY[
      'manual'::text,
      'purchase'::text,
      'sale'::text,
      'adjustment'::text,
      'sale_return'::text,
      'sale_cancellation'::text,
      'system'::text
    ])
  );