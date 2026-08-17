# Plan - Fix Consignment Company Identification

The "Empresa não identificada" error in the Consignment feature occurs because the `useAuth` hook was not exposing the `company_id` from the user's profile, and the components were trying to access it via an non-existent property on the `user` object.

## Proposed Changes

### Auth Provider
- Update `AuthProvider` in `src/providers/auth-provider.tsx` to fetch the user's profile from the `profiles` table and expose `companyId` in the context.
- Add console logging to verify the profile fetch and the resulting `companyId`.

### Consignment Feature
- Update `ResellersList` in `src/features/consignment/components/resellers-list.tsx` to use the new `companyId` from `useAuth`.
- Update `ConsignmentsList` in `src/features/consignment/components/consignments-list.tsx` to use the new `companyId` from `useAuth`.
- Verify `CreateConsignmentDialog` in `src/features/consignment/components/create-consignment-dialog.tsx` (it already receives `companyId` as a prop).

## Technical Details

- The `profiles` table contains the `current_company_id` which defines the active tenant context for the user.
- Components will now reactively update when `companyId` is resolved from the database.
- RLS policies on `resellers` and `consignacoes` require the correct `company_id` to be passed to service methods.

```typescript
// Example usage in components
const { companyId, loading: authLoading } = useAuth();
```
