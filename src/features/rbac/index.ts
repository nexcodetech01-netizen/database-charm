export { usePermissions } from "./hooks/use-permissions";
export { useRole } from "./hooks/use-role";
export { Can } from "./components/can";
export { requirePermission } from "./guards/require-permission";
export { fetchUserPermissions, permissionsQueryKey } from "./lib/fetch-permissions";
export {
  RBAC_MODULES,
  RBAC_ACTIONS,
  SYSTEM_ROLES,
  type PermissionCode,
  type RbacModule,
  type RbacAction,
  type SystemRoleName,
} from "./lib/permission-codes";
