# Plan: Product Consignment Feature

Implement a product consignment system following the multi-tenant architecture and design system of NexOS. This feature allows the business to deliver products to resellers and receive payment only for items effectively sold, with a PDF contract generation capability.

## Database Schema (Supabase)

1.  **Enums**:
    *   `consignment_status`: `ativa`, `fechada`, `cancelada`
    *   `commission_type`: `percentual`, `valor_fixo`
    *   `consignment_settlement_status`: `pendente`, `pago`
2.  **Tables**:
    *   `resellers` (`revendedores`): Basic info (name, doc, phone, address).
    *   `consignments` (`consignacoes`): Master record (reseller, date, commission, status, PDF URL).
    *   `consignment_items` (`consignacao_itens`): Line items (product, sent, sold, returned, cost/price snapshots).
    *   `consignment_settlements` (`consignacao_fechamentos`): Closing records (date, snapshot, gross, commission, net to receive, payment status).
3.  **Security**:
    *   Enable RLS on all tables.
    *   Implement policies using `auth.jwt() -> tenant_id`.
    *   Grant access to `authenticated` and `service_role`.

## Backend Logic

1.  **Consignment Service** (`src/features/consignment/services/consignment.service.ts`):
    *   Create consignment (validate stock/existence).
    *   Calculate settlement values (gross sold, commission, net).
    *   Update item counts (accumulate sold/returned).
2.  **PDF Generation** (`src/features/consignment/lib/pdf.server.ts`):
    *   Server function to generate a simple PDF using a compatible library (or base64 image/HTML pattern if restricted).
    *   Upload to Supabase Storage (`consignment-contracts` bucket).
    *   Update URL in the database.

## UI Components (Design System compliant)

1.  **Reseller List**: Table with CRUD and "New Consignment" action.
2.  **New Consignment Form**: Reseller selector, date, commission settings, and a multi-line product selector (cart-like).
3.  **Consignment Details**: Status overview, items table (view/edit sold/returned), settlement history.
4.  **Settlement Modal**: Input for current sold/returned units, auto-calc totals, confirmation.
5.  **Dashboard**: Summary cards (total consigned, sold, pending) and general listing with filters.

## Implementation Steps

1.  **Migration**: Create tables, enums, RLS, and grants.
2.  **Feature Scaffolding**: Create `src/features/consignment` folder structure.
3.  **Types & Zod Schemas**: Define data structures.
4.  **Repositories & Services**: Implement data access and business logic.
5.  **Routes**: Add `/_authenticated/consignacoes`, `/_authenticated/revendedores`, and details routes.
6.  **UI Construction**: Build components and integrate with services.
7.  **PDF Integration**: Implement the contract generation flow.
8.  **Testing**: Verify RLS and inventory logic.

## Technical Details

*   **RLS**: `USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)`
*   **Storage**: New bucket `consignment-contracts` with tenant-scoped RLS.
*   **Inventory**: Note that consignment items are snapshots; physical stock reduction logic should be verified (usually stock is "locked" or moved to a virtual location, but for this MVP we will follow the "manual control" requirement).
*   **PDF**: Will attempt to use a pure JS approach or a server function calling a rendering service if `jspdf` or similar is available in the environment.
