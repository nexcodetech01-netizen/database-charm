# Plan: Fix Catalog Category Menu and Product Visibility

Audited the catalog and found that while "Vestuário" (and other categories) are visible in the new UI, they are missing from the menu in the legacy route the user is accessing. The current implementation of `src/routes/catalogo.colecao.$slug.tsx` uses a `flex-wrap` container that works for the new UI, but the user is likely seeing a different version or a specific configuration issue where categories without products in the active collection are filtered out.

## User Review Required

> [!IMPORTANT]
> The category "Vestuário" is visible in the new TanStack Start catalog (`/catalogo/colecao/tg-style-catalogue`), but you mentioned it's missing from the menu. The menu items you listed (INÍCIO, CARTEIRAS, etc.) appear to be from a legacy version of the site. I will ensure the new catalog menu is prominent and that all products from "Vestuário" are correctly associated and visible.

## Proposed Changes

### Catalog Feature
#### [src/routes/catalogo.colecao.$slug.tsx]
- Refine the category menu to be more prominent and professional.
- Ensure the "flex-wrap" behavior handles many categories gracefully.
- Add a "Show All" or "View More" toggle if the number of categories exceeds a certain threshold, though `flex-wrap` currently handles visibility.

### Product Service
#### [src/features/products/services/products.service.ts]
- Update the `addProducts` logic to ensure that when a product is created or updated with the "catalog" channel, it is linked to the correct collection ID (`tg-style-catalogue`).
- Verify that the `MAIN_COLLECTION_ID` used in `products.service.ts` matches the actual production ID for "TG Style Catalogue".

### Data Correction
- Run a migration script to ensure all products in the "Vestuário" category that have the "catalog" sales channel are correctly linked to the `tg-style-catalogue` collection.

## Technical Details
- The `loadCollectionPagePayload` in `load-collection-page.server.ts` filters products by `status === 'active'` and `stock > 0`. If "Vestuário" products have 0 stock, they won't appear, and their category won't show in the menu.
- I will verify if the user wants to show out-of-stock items in the category menu or if the "Vestuário" products simply need their stock updated.
