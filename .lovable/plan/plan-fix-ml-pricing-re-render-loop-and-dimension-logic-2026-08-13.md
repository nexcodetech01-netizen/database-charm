# Plan - Fix ML Pricing Re-render Loop and Dimension Logic

Fix the re-render loop in Mercado Livre pricing settings and ensure product dimensions respect user input while using placeholders for new products.

## Technical Details

### 1. Fix Re-render Loop in `PublishToMercadoLivreDialog`
- Implement `useDebounce` hook to delay price and wallet target calculations.
- Wrap calculation functions in `useCallback`.
- Refactor `useEffect` dependencies to break circular updates between `price` and `walletTarget`.
- Use a ref to track manual edits and prevent overwriting user input during re-renders.

### 2. Fix Logistics Dimensions Logic
- Update `ProductForm` to only use "0.3kg" and "15x15x15" as initial placeholders for NEW products.
- Ensure `toState` handles existing dimension values correctly (no fallback to default if value exists in DB).
- Update `LogisticsForm` to show placeholders instead of hardcoded default values in inputs.

## Proposed Changes

### Hooks
#### [NEW] `src/hooks/use-debounce.ts`
- Standard debounce hook for generic values.

### Pricing Feature
#### `src/features/products/components/publish-to-ml-dialog.tsx`
- Import `useDebounce`.
- Debounce `walletTarget` and `price` inputs.
- Memoize `calculateMLFinalPrice` and `calculateMLNetValue` calls.
- Fix `useEffect` that synchronizes `price` from `walletTarget` to avoid loop.

### Logistics Feature
#### `src/features/products/components/product-form/index.tsx`
- Modify `empty` state to have empty strings for dimensions.
- Update `toState` to preserve `0` or `null` if they are valid values from DB.
- Set defaults only if `!isEdit` and fields are empty.

#### `src/features/products/components/product-form/modules/logistics-form.tsx`
- Add `placeholder` props to `Input` fields for weight, width, height, and length.
