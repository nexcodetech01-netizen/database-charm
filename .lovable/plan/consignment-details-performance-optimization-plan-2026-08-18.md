# Consignment Details Performance Optimization Plan

The user reported slowness in the Consignment Details screen (`/consignacoes/:id`). The goal is to optimize data loading, ensure proper database indexing, and verify that routing failsafes aren't impacting performance.

## Proposed Changes

### Database Optimization
- Create missing indexes on `consignment_id` for `consignment_items` and `consignment_settlements` tables to speed up foreign key lookups.

### Frontend Optimization
- **Parallelize Queries**: Currently, `ConsignmentDetails` uses two separate `useQuery` hooks. While they run in parallel in the browser, the data from the first is needed before the second might be useful (items vs settlements). However, we can use TanStack Router's `loader` to prefetch these in parallel on the server/client before the component renders.
- **Combined Fetching**: Alternatively, update `ConsignmentService.getConsignment` to also return settlements in its `Promise.all` block to reduce waterfalling and round-trips.
- **Root Failsafe Check**: Inspect `src/routes/__root.tsx` for the `useEffect` global failsafe. Optimize it to ensure it only runs once per navigation and uses minimal resources.

### Architectural Improvements
- Move data fetching to the route loader to leverage TanStack Start's SSR and prefetching capabilities.

## Technical Details

### 1. Database Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_consignment_items_consignment_id ON public.consignment_items(consignment_id);
CREATE INDEX IF NOT EXISTS idx_consignment_settlements_consignment_id ON public.consignment_settlements(consignment_id);
```

### 2. Service Layer Refactor
Update `ConsignmentService.getConsignment` to include settlements:
```typescript
static async getConsignment(id: string) {
  const [consignmentRes, itemsRes, settlementsRes] = await Promise.all([
    supabase.from('consignacoes').select('*, reseller:resellers(*)').eq('id', id).single(),
    supabase.from('consignment_items').select('*, product:products(...)').eq('consignment_id', id),
    supabase.from('consignment_settlements').select('*').eq('consignment_id', id).order('created_at', { ascending: false })
  ]);
  // ... return all
}
```

### 3. Component Refactor
- Update `ConsignmentDetails` to use the combined data.
- Remove redundant `useQuery` for settlements.

### 4. Root Failsafe Audit
Verify the `useEffect` in `src/routes/__root.tsx`. The current implementation uses `setTimeout(0)`, which is fine, but we should ensure it doesn't trigger unnecessary re-renders or heavy DOM operations.
