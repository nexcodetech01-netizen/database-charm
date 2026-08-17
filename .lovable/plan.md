# Plan: Fix Actions in Consignments List

Fixing the non-functional "Ver Detalhes", "Gerar Contrato", and "Cancelar" buttons in the consignment list.

## Proposed Changes

### Frontend Improvements

#### 1. Consignments List Component (`src/features/consignment/components/consignments-list.tsx`)
- Implement `handleViewDetails` using `useNavigate` to navigate to `/consignacoes/$id`.
- Refactor "Gerar Contrato" to use a dedicated handler and ensure it handles loading states.
- Implement "Cancelar" with a confirmation dialog (using `window.confirm` for now or a custom dialog if preferred) and a mutation to update status.
- Add `useNavigate` from `@tanstack/react-router`.
- Connect `onClick` handlers to all dropdown items.

### Backend/Service Improvements

#### 1. Consignment Service (`src/features/consignment/services/consignment.service.ts`)
- Add `updateConsignmentStatus(id: string, status: ConsignmentStatus)` method to handle cancellations.

### Infrastructure

#### 1. Routes
- Create `src/routes/_authenticated/consignacoes.$id.tsx` to handle the detail view (initially just a placeholder or a simple view if enough info is available).

## Technical Details
- **Routing**: Using `@tanstack/react-router` for navigation.
- **State Management**: Using `@tanstack/react-query`'s `useMutation` for the cancellation action to ensure the UI updates after the status change and the list is invalidated.
- **PDF Generation**: Reusing the existing `generateConsignmentPDF` utility.

## Validation Plan
1. **Ver Detalhes**: Click the button and verify it navigates to `/consignacoes/[ID]`.
2. **Gerar Contrato**: Click the button and verify a PDF is generated and downloaded.
3. **Cancelar**: Click the button, confirm the dialog, and verify the status changes to "Cancelada" in the list.
