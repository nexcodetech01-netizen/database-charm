# Plan - Fix Product Image Saving and Kit Stock Calculation

Fix two critical bugs in the product management module: image URL persistence and incorrect kit stock calculation (summing instead of bottleneck minimum).

## Proposed Changes

### 1. Fix Image URL Saving
- **Problem**: When a new product image is uploaded, it is saved to `cover_image_path` but the public URL is not being persisted to the `image_url` column in the `products` table as requested.
- **Solution**: 
    - In `ProductForm.submit`, after successful upload to storage, generate the public URL using `supabase.storage.from(BUCKET).getPublicUrl(path)`.
    - Update the product payload to include both `cover_image_path` and `image_url`.
    - Ensure the mutation targeting the specific product `id` includes these fields.

### 2. Fix Kit Stock Calculation (13 UN -> 3 UN)
- **Problem**: The kit stock is displaying 13 UN (sum of components 5+5+3) instead of 3 UN (the bottleneck minimum). This is caused by duplicate items in the composition query or a logic error during stock calculation.
- **Solution**:
    - Refactor `calculateKitStock` in `products.service.ts` to ensure it only considers unique components (by `component_id`) for a specific `parent_id`.
    - Use a `Map` or `Set` to deduplicate components before calculation.
    - Verify that `Math.min` is applied correctly to the calculated stocks of each unique component.
    - Update `productsService.list` and `productsService.get` to use the fixed calculation.

## Technical Details
- Files to modify:
    - `src/features/products/components/product-form/index.tsx`: Update `submit` logic for image public URL.
    - `src/features/products/services/products.service.ts`: Fix `calculateKitStock` deduplication and ensure minimum-based logic.
    - `src/features/products/components/product-form/modules/kit-composition-module.tsx`: Update internal `useMemo` for kit stock to match the service logic.
