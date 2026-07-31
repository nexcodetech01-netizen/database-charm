import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { usePermissions } from "./use-permissions";
import type { SystemRoleName } from "../lib/permission-codes";

export interface AssignedRole {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

/**
 * Returns the roles assigned to the current user in the current company.
 * The company owner is always represented with the synthetic `owner` role,
 * regardless of user_roles rows.
 */
export function useRole() {
  const { user } = useAuth();
  const { companyId, isOwner, isLoading: permsLoading } = usePermissions();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: ["rbac", "user-roles", userId, companyId],
    enabled: !!userId && !!companyId && !isOwner,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role:roles(id, name, description, is_system)")
        .eq("user_id", userId!)
        .eq("company_id", companyId!);

      type Row = { role: AssignedRole | null };
      const rowsTyped = (data ?? []) as unknown as Row[];
      return rowsTyped
        .map((row) => row.role)
        .filter((r): r is AssignedRole => !!r);
    },
  });

  const roles: AssignedRole[] = isOwner
    ? [{ id: "__owner__", name: "owner", description: "Proprietário", is_system: true }]
    : (query.data ?? []);

  const roleNames = roles.map((r) => r.name);
  const primaryRole = roles[0]?.name ?? null;

  return {
    isLoading: permsLoading || query.isLoading,
    roles,
    roleNames,
    primaryRole,
    hasRole: (name: SystemRoleName | string) => roleNames.includes(name),
    hasAnyRole: (names: Array<SystemRoleName | string>) =>
      names.some((n) => roleNames.includes(n)),
  };
}
