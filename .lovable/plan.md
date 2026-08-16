# Plan - SuperFrete Label Generation Integration

Implement the full flow for shipping label generation using the SuperFrete API, extending the existing calculator tool into a complete internal shipping management tool.

## Technical Details

### Backend & API
- **SuperFrete API Flow**:
    1. `POST /api/v0/cart`: Add a package to the cart using quote data.
    2. `POST /api/v0/checkout`: Pay for the items in the cart using the wallet balance.
    3. `POST /api/v0/label`: Generate the label PDF.
- **New API Route**: `src/routes/api/public/shipping/labels.ts` to handle cart addition, checkout, and label generation server-side.
- **Updated API Route**: `src/routes/api/public/shipping/calculate.ts` to include the `package_id` or quote identifiers in the response.

### Business Logic
- **Types**: Update `src/features/shipping/types.ts` to include sender/recipient details and label response data.
- **Server Functions**: Create `generateLabel` server function in `src/features/shipping/services/shipping.functions.ts`.

### UI/UX Updates
- **Step-based UI**: Modify `src/routes/_authenticated/ferramentas.calculadora-frete.tsx` to handle the two-step flow (Quote -> Label).
- **Forms**:
    - Step 1: Physical package details (existing).
    - Step 2: Sender (defaults from secrets) and Recipient details (Name, Document, Address, Contact).
- **Result Display**: Show the label download link and tracking code upon success.
- **Error Handling**: Explicitly handle wallet balance issues and address validation errors.

### Infrastructure
- **Secrets**: Use `SUPERFRETE_REMETENTE_*` for default sender information.

## User Review Required
> [!IMPORTANT]
> The SuperFrete API requires specific steps for cart and checkout. Please confirm if you have a balance in your SuperFrete wallet, as the labels will be paid using your account balance.
