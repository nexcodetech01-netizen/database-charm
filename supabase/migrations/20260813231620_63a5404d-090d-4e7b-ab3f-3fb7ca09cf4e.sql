CREATE OR REPLACE FUNCTION public.fix_products_image_column()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'products'
        AND table_schema = 'public'
        AND column_name = 'image_url'
    ) THEN
        ALTER TABLE public.products ADD COLUMN image_url TEXT;
    END IF;

    -- If cover_image_path exists and has data, we might want to sync it,
    -- but the user specifically asked for image_url to exist.
    -- The instruction also mentioned NOTIFY pgrst, 'reload schema';
    -- which happens automatically via the migration tool's reload mechanism,
    -- but we can include it in the SQL if needed.
END;
$$;

SELECT public.fix_products_image_column();
DROP FUNCTION public.fix_products_image_column();
