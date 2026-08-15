---
title: Fix Product Search Accents (unaccent)
description: Enable PostgreSQL unaccent extension and adjust product search logic to ignore accents for better matching.
---

## Objective
Fix the product search bug where accents prevent matches. Users should be able to search for "relogio" and find "Relógio".

## Proposed Changes

### Database Migration
1. Enable the `unaccent` extension in the `public` schema.
2. Create a security definer function `public.unaccent_text(input text)` to safely expose unaccent to RLS/PostgREST.
3. (Optional but recommended) Create a dedicated search RPC `search_products_unaccent` if PostgREST `ilike` filters are insufficient, or use the unaccented comparison in a custom function.
    - *Decision:* I will create a function `public.search_products(search_term text)` that uses `unaccent` for matching across columns.

### Frontend Logic
1. Update `src/features/products/lib/product-search.ts` to use the new RPC or adjust the query logic.
    - If using RPC: Change `applyProductSearch` to call the RPC instead of chaining `.or()`.
    - If using PostgREST filters: PostgREST doesn't support calling functions inside `.ilike()`. I will implement the RPC approach for accuracy and performance.

## Technical Details

### SQL Migration
```sql
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.search_products(search_term text)
RETURNS SETOF public.products AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.products
  WHERE 
    unaccent(name) ILIKE unaccent('%' || search_term || '%') OR
    unaccent(sku) ILIKE unaccent('%' || search_term || '%') OR
    unaccent(brand) ILIKE unaccent('%' || search_term || '%') OR
    unaccent(description) ILIKE unaccent('%' || search_term || '%');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.search_products(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_products(text) TO service_role;
```

### TypeScript Adjustment
Refactor `applyProductSearch` to utilize the RPC or provide a fallback. Note: TanStack Query logic using this search might need to be aware of the RPC call.

## Validation Plan
1. **Manual Test:** Use the PDV or Products list to search "relogio" and verify "Relógio" appears.
2. **Automated Test:** Create a script to call `search_products` via Supabase client and verify results.
3. **Regression:** Run existing product search tests to ensure multi-word search and channel filtering still work.
