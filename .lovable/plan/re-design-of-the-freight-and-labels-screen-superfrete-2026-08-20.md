# Re-design of the Freight and Labels Screen (SuperFrete)

Redesign the UI of the Freight Calculator / Freight and Labels tool to a premium, professional ERP layout, focusing on visual hierarchy, consistency with the NexOS dark theme, and a balanced two-column desktop layout.

## User Review Required

> [!IMPORTANT]
> - No functional logic, API calls, or server functions will be modified.
> - The SuperFrete integration and label generation rules remain untouched.
> - The design will use existing NexOS tokens and components.

## Proposed Changes

### UI & Layout

#### 1. Header & Navigation
- Add a discrete breadcrumb: `Ferramentas > Calculadora de Frete`.
- Rename PageHeader title to "Frete e Etiquetas".
- Update subtitle: "Calcule fretes e gere etiquetas para seus pedidos."
- Add a small `Badge` indicating "SuperFrete" integration.

#### 2. Balanced Two-Column Main Area
- **Left Column (Shipping Data):**
  - **Origin Card:** Compact layout for CEP, Format, Weight, and Dimensions.
  - **Destination Card:** Professional tabbed interface (Novo / Recentes) for destination data.
  - **Main Action:** A prominent, elegantly styled "Calcular frete" button.
- **Right Column (Quotation):**
  - **Empty State:** Professional empty state with a delivery icon and instructions.
  - **Results Area:** Organized list of shipping options highlighting Carrier, Deadline, Price, and Actions.
  - **Compact Errors:** Transform large error alerts into compact, descriptive warnings within the results panel with a "Try Again" option.

### Design System & Responsiveness
- **Dark Theme Consistency:** Enforce NexOS dark theme values, subtle borders, and consistent corner radii.
- **Uniform Inputs:** Standardize all input fields to match the ERP's professional design.
- **Responsive Layout:**
  - **Desktop:** Balanced two-column grid.
  - **Tablet/Notebook:** Optimized spacing to prevent overflow.
  - **Mobile:** Single-column stacking for a seamless experience.

## Technical Details

- **File to Modify:** `src/routes/_authenticated/ferramentas.calculadora-frete.tsx`
- **Component Updates:**
  - Replace custom step indicators with a more standard breadcrumb + header flow.
  - Re-structure the JSX grid from a `lg:col-span-5/7` to a more balanced layout if possible, or refine the existing spans for better hierarchy.
  - Update `Card`, `Button`, and `Input` styling to use NexOS semantic tokens.
  - Implement a dedicated `EmptyState` view for the results column.
  - Refactor the error rendering logic to be localized and compact.

## Validation Plan

1. **Visual Inspection:** Verify the new layout in the preview across mobile, tablet, and desktop viewports.
2. **Type Check:** Run `tsgo` to ensure all prop types and state usages remain correct after JSX refactoring.
3. **Build Check:** Execute `bun run build` to confirm the production bundle compiles without errors.
4. **Functional Smoke Test:** Confirm that clicking "Calcular frete" still triggers the server function and displays results/errors correctly.
