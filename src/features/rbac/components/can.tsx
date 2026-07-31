import type { ReactNode } from "react";
import { usePermissions } from "../hooks/use-permissions";
import type { PermissionCode } from "../lib/permission-codes";

interface CanProps {
  /** Single permission code, e.g. `products.create`. */
  permission?: PermissionCode | string;
  /** Any of the given codes grants access. */
  anyOf?: Array<PermissionCode | string>;
  /** Fallback rendered when the user lacks permission. */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Conditionally renders children based on the current user's permissions.
 * Owner (companies.owner_id) always has access.
 */
export function Can({ permission, anyOf, fallback = null, children }: CanProps) {
  const { has, hasAny, isLoading } = usePermissions();

  if (isLoading) return null;

  const allowed = permission
    ? has(permission)
    : anyOf && anyOf.length > 0
      ? hasAny(anyOf)
      : true;

  return <>{allowed ? children : fallback}</>;
}
