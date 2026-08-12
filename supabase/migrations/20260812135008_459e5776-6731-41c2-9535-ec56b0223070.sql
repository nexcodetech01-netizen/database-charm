-- RLS Policies for product-images bucket
-- Note: The bucket already exists.

-- 1. Public Read Access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Public Access to product-images'
    ) THEN
        CREATE POLICY "Public Access to product-images" ON storage.objects
        FOR SELECT TO public
        USING (bucket_id = 'product-images');
    END IF;

    -- 2. Authenticated Upload
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Authenticated Upload to product-images'
    ) THEN
        CREATE POLICY "Authenticated Upload to product-images" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'product-images');
    END IF;

    -- 3. Owner Management (Update/Delete)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Owner Access to product-images'
    ) THEN
        CREATE POLICY "Owner Access to product-images" ON storage.objects
        FOR ALL TO authenticated
        USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);
    END IF;
END
$$;