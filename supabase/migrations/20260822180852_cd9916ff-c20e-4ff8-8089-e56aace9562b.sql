
CREATE POLICY "Public can view active catalog products"
ON public.products
FOR SELECT
TO anon
USING (
    status = 'active' 
    AND sales_channels @> ARRAY['catalog']::text[]
    AND EXISTS (
        SELECT 1 
        FROM public.product_collection_items pci
        JOIN public.product_collections pc ON pc.id = pci.collection_id
        WHERE pci.product_id = products.id
        AND pc.status = 'active'
    )
);

CREATE POLICY "Public can view product categories"
ON public.product_categories
FOR SELECT
TO anon
USING (true);

-- No explicit grants needed as they should already exist for authenticated/service_role, 
-- but we need to ensure anon has select if not already there.
GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.product_categories TO anon;
GRANT SELECT ON public.product_collections TO anon;
GRANT SELECT ON public.product_collection_items TO anon;
