# Plan: Correction of Product Pricing Logic and Category Sync

Correct the critical pricing mathematics and category margin synchronization in the `PricingSection` (implemented via `PricingForm.tsx`) to ensure mandatory cost summation and accurate category policy application.

## User Review Required

> [!IMPORTANT]
> The "Category Margin" switch will now strictly enforce the `target_margin_pct` from the selected category in the Supabase database. If a category doesn't have a margin set, it will fallback to the company's default policy.

- **Pricing Formula**: The system will use the "Margin over Sale" formula: `Final Price = Effective Total Cost / (1 - (Margin / 100))`.
- **Operational Costs**: Packaging and Other Costs will now correctly load from `organization_settings` (Supabase `companies` table) for new products.

## Proposed Changes

### Frontend - Product Pricing Form

#### [src/features/products/components/product-form/modules/pricing-form.tsx](src/features/products/components/product-form/modules/pricing-form.tsx)
- Refactor the cost summation logic to explicitly sum `unit_cost + freight + packaging + insurance + other_costs`.
- Update the `recalculatePrice` function to strictly use the "Margin over Sale" formula: `totalCost / (1 - margin/100)`.
- Update the Category Switch UI to display the specific category name and percentage: "Aplicar política de [Category] ([X]%)".
- Ensure that changing any individual cost component (unit cost, freight, etc.) triggers an immediate recalculation of the `totalCost` and `price`.
- Lock the `margin` input when "Use Category Margin" is active.

#### [src/features/products/components/product-form/index.tsx](src/features/products/components/product-form/index.tsx)
- Ensure the `pricingInputs` hook (which fetches category and company policies) correctly propagates the `targetPct` to the `PricingForm`.
- Verify that `onApplyCategoryMargin` correctly sets the `use_category_margin` flag and updates the form state with the category's margin.

### Backend/Logic - Commercial Engine Integration

#### [src/features/pricing/official/official-pricing.ts](src/features/pricing/official/official-pricing.ts)
- Verify `buildContext` correctly handles all cost components as unit values. (Already seems robust, but will ensure `PricingForm` sends them correctly).

## Verification Plan

### Automated Tests
- No specific new tests, but will verify build stability.

### Manual Verification
1. Open the Product creation form.
2. Select a category (e.g., "Acessórios para Celulares") that has a 50% margin in the database.
3. Observe if "Packaging" and "Other Costs" load the company defaults (e.g., 2.30 and 0.10).
4. Enter a Unit Cost of 2.77.
5. Verify `Total Effective Cost` displays 5.17 (2.77 + 2.30 + 0.10).
6. Enable "Usar margem da categoria".
7. Verify the switch text shows "Aplicar política de Acessórios para Celulares (50%)".
8. Verify `Final Price` becomes 10.34 (5.17 / 0.5).
9. Change "Freight" to 1.00 and verify `Final Price` updates to 12.34 (6.17 / 0.5).
