# Plan - Fix Temporal Dead Zone and Supabase Query Syntax

Fix two critical issues: a React `ReferenceError` caused by a Temporal Dead Zone in `ProductForm` and a Supabase `400 Bad Request` caused by invalid filter syntax for NCM.

## Proposed Changes

### 1. Fix Temporal Dead Zone in `ProductForm`
- **Problem**: `ReferenceError: Cannot access '...' before initialization`. This occurs because `empty` or other helpers are referenced by `useEntityForm` or `useState` before they are defined in `src/features/products/components/product-form/index.tsx`.
- **Solution**: 
    - Move `empty` FormState, `toState` helper, `calculateKitStock` helper, and the `schema` Zod object to the top of the file, immediately after imports and before the `ProductForm` component definition.
    - Ensure all hooks inside `ProductForm` follow a safe initialization order.

### 2. Fix Supabase Query Syntax (HTTP 400)
- **Problem**: The filter `or=(ncm.is.null,ncm.eq.)` is invalid in PostgREST/Supabase.
- **Solution**:
    - Locate the query in `src/features/products/lib/fiscal-suggestions.ts` (or relevant service).
    - Change `.or('ncm.is.null,ncm.eq.')` to `.or('ncm.is.null,ncm.eq.""')` or `.or('ncm.is.null,ncm.eq.\'\'')`.

### 3. Ensure Clean Form Reset
- **Problem**: "Novo Produto" needs to initialize cleanly.
- **Solution**:
    - Verify `useEntityForm` initializer logic handles the `undefined` product case by returning the `empty` state.
    - Explicitly call `reset()` or ensure the state is correctly set when the route changes to `/novo`.

## Technical Details
- Files to modify:
    - `src/features/products/components/product-form/index.tsx`: Reorder declarations to fix TDZ.
    - `src/features/products/lib/fiscal-suggestions.ts`: Fix NCM query filter syntax.
