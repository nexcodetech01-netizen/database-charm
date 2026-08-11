# Refactor Product Price & Costs UI/UX

Refactor the `PricingForm` component to improve currency formatting, dynamic margin calculation, and the "Category Margin" logic.

## Proposed Changes

### UI/UX Updates

- **Currency Masking**:
    - Replace standard `<Input>` with a new `<BRLCurrencyInput>` (based on `CurrencyInput`) for "Custo Unitário", "Frete", "Embalagem", and "Preço de Venda Final".
    - These fields will handle cents correctly (e.g., typing `4400` displays `R$ 44,00`) and emit raw numeric values.
- **Dynamic Margin Visualizer**:
    - Calculate **Custo Total Efetivo** (Cost + Freight + Packaging + etc).
    - Calculate **Margin (%)** and **Gross Profit (R$)**.
    - Implement a color-coded Badge:
        - `< 0%`: Red (Prejuízo).
        - `0% - 20%`: Yellow (Margem Baixa).
        - `> 20%`: Green (Lucrativo).
    - Display "Lucro Bruto: R$ X,XX por unidade" as helper text.
- **Category Margin Logic**:
    - If "Usar margem da categoria" is **ON**:
        - Disable manual editing of "Preço de Venda Final".
        - If no category is selected, show a clear warning/alert.
    - If the user manually clicks/edits the price, the switch automatically turns **OFF**.

## Technical Details

- **Files to Modify**:
    - `src/features/products/components/product-form/modules/pricing-form.tsx`: Main UI logic.
- **New Component**:
    - Create `src/components/ui/brl-currency-input.tsx` to handle the specific "type 4400 -> R$ 44,00" behavior (standard `CurrencyInput` usually formats on blur, I'll adapt it for a smoother experience if needed, or stick to the project's `CurrencyInput` if it fits).
- **Validation**:
    - Ensure `onApplyCategoryMargin` is called when the switch toggles.
