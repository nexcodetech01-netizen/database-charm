import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAuth } from "@/providers/auth-provider";
import type { PermissionCode } from "../lib/permission-codes";
import { fetchUserPermissions, permissionsQueryKey } from "../lib/fetch-permissions";

/**
 * Loads the current user's company + permission set.
 *
 * Backward-compat: the company owner (owner_id) implicitly holds every
 * permission — no user_roles row is required. This matches the SQL
 * `has_permission()` function.
 */
export function usePermissions() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: permissionsQueryKey(userId),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: () => fetchUserPermissions(userId),
  });


  const permissions = query.data?.permissions ?? new Set<string>();
  const isOwner = query.data?.isOwner ?? false;

  const has = useMemo(
    () => (code: PermissionCode | string) => {
      if (isOwner || permissions.has("*")) return true;
      return permissions.has(code);
    },
    [permissions, isOwner],
  );

  const hasAny = useMemo(
    () => (codes: Array<PermissionCode | string>) => {
      if (isOwner || permissions.has("*")) return true;
      return codes.some((c) => permissions.has(c));
    },
    [permissions, isOwner],
  );

  return {
    isLoading: query.isLoading,
    isOwner,
    companyId: query.data?.companyId ?? null,
    permissions,
    has,
    hasAny,
  };
}
