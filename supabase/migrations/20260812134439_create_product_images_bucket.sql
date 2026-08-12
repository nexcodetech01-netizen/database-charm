-- Create product-images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
SELECT 'product-images', 'product-images', true
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'product-images'
);

-- Policy for public read access
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

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Owner Access to product-images'
    ) THEN
        CREATE POLICY "Owner Access to product-images" ON storage.objects
        FOR ALL TO authenticated
        USING (bucket_id = 'product-images' AND owner = auth.uid());
    END IF;
END
$$;
