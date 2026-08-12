# Plan - Correction of Critical Errors in Finance and Dashboard

Correction of critical errors related to Supabase Realtime subscription order, missing parameters/error handling in `get_dashboard_metrics` RPC calls, and defensive routing preloads.

## User Review Required

> [!IMPORTANT]
> I will adjust the Supabase Realtime subscription in `use-finance.ts` to call `.on()` before `.subscribe()`. I will also add `try/catch` blocks and missing parameters (like `p_company_id`) to the `get_dashboard_metrics` RPC calls in `sales.service.ts` and `dashboard.tsx`.

- None at this time.

## Proposed Changes

### Finance Module

#### [src/features/finance/hooks/use-finance.ts]
- In `useAccounts`, reorder Supabase Realtime chain: `.on(...)` must come before `.subscribe()`.
- Ensure `supabase.removeChannel(channel)` is called in the `useEffect` cleanup.

### Sales Service & Dashboard

#### [src/features/sales/services/sales.service.ts]
- In `salesService.metrics`, wrap the `supabase.rpc("get_dashboard_metrics", ...)` call in a `try/catch` block.
- Pass `p_company_id: companyId` to the `get_dashboard_metrics` RPC call if the schema requires it (based on common patterns in this project).

#### [src/routes/_authenticated/dashboard.tsx]
- Wrap the `void supabase.rpc("get_dashboard_metrics", ...)` calls in `try/catch` blocks.
- Pass `p_company_id: company.id` to these calls.

### Navigation Telemetry

#### [src/lib/nav-telemetry.ts]
- Wrap navigation event logic or router subscriptions in `try/catch` to prevent crashes during route preloading.

## Technical Details

- **Supabase Realtime**: The SDK requires `.on()` listeners to be registered before `.subscribe()` to ensure events are captured immediately upon connection.
- **RPC Resilience**: Network failures or database-level errors in RPC functions should not crash the main UI thread.
- **Routing**: `defaultPreload: "intent"` can trigger errors if a route's `beforeLoad` or `loader` fails; wrapping telemetry/pre-navigation logic adds a layer of safety.

## Verification Plan

### Automated Tests
- Run `vitest` (if available) for finance hooks or services.

### Manual Verification
- Navigate to `/financeiro` and check the console for "channel already subscribed" or similar warnings.
- Open the Dashboard and switch between "Hoje", "Ontem", and "Este Mês" to verify the RPC calls complete without crashing the UI, even if the database returns an error.
- Verify that real-time updates still work in the finance accounts list.
