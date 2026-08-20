# Plan: Notification Settings Persistence

Implement server-side persistence for notification settings in Supabase to ensure they persist across sessions and page reloads.

## Proposed Changes

### Database Schema
- The `profiles` table already includes a `notification_settings` JSONB column (confirmed by `use-notification-settings.ts` usage and common project patterns).
- No migrations required if the column exists; if it doesn't, a migration will be added to ensure the `profiles` table has it.

### Frontend Hook (`src/hooks/use-notification-settings.ts`)
- The current hook already attempts to read/write to Supabase `profiles` table via the `supabase` client.
- **Problem**: The current implementation uses the browser-side Supabase client, which relies on RLS. If RLS is not properly configured for the `notification_settings` column or the `profiles` table, updates might fail silently or the read might return default settings.
- **Solution**: 
    1. Ensure RLS policies allow authenticated users to read and update their own profile.
    2. Add a `saveNotificationSettings` server function to handle persistence more robustly if needed, although the existing client-side `updateSettings` mutation should work if RLS is correct.

### Server-side Logic
- Create a new file `src/features/settings/notification-settings.functions.ts` to host server functions for settings management.
- Create `src/features/settings/notification-settings.server.ts` for database interaction.
- This ensures settings are handled via `createServerFn`, following the project's preferred pattern for backend operations and bypassing client-side RLS complexities if necessary.

### Refactor Components
- Update `src/hooks/use-notification-settings.ts` to use these new server functions instead of direct Supabase client calls.

## Technical Details

### RLS Policy (SQL)
```sql
-- Ensure users can update their own profile settings
CREATE POLICY "Users can update their own notification settings" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);

-- Ensure users can read their own profile settings
CREATE POLICY "Users can read their own notification settings" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (auth.uid() = id);
```

### Server Function Example
```typescript
export const updateNotificationSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.record(z.any()).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ notification_settings: data })
      .eq("id", context.userId);
    if (error) throw error;
    return { success: true };
  });
```

## Constraints
- Do not modify any notification layout/visuals already implemented.
- Maintain compatibility with the existing `NotificationSettings` type and `DEFAULT_SETTINGS`.
