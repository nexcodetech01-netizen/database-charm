ALTER TABLE public.products ADD COLUMN IF NOT EXISTS video_url text;

-- Tenta criar as políticas para o bucket product-media (assumindo que o bucket existe ou será criado)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Public Access for product-media'
    ) THEN
        CREATE POLICY "Public Access for product-media" ON storage.objects FOR SELECT TO public USING (bucket_id = 'product-media');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Authenticated Upload for product-media'
    ) THEN
        CREATE POLICY "Authenticated Upload for product-media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-media');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Authenticated Delete for product-media'
    ) THEN
        CREATE POLICY "Authenticated Delete for product-media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-media');
    END IF;
END
$$;
