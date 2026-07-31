/**
 * Canonical list of RBAC modules and actions.
 * Kept in sync with the seed in migration 2026-07-13 (Sprint 16).
 */
export const RBAC_MODULES = [
  "dashboard",
  "products",
  "categories",
  "purchases",
  "inventory",
  "suppliers",
  "customers",
  "crm",
  "agenda",
  "sales",
  "finance",
  "bella_pay",
  "reports",
  "marketing",
  "bella_ia",
  "fiscal",
  "settings",
] as const;

export const RBAC_ACTIONS = ["view", "create", "update", "delete", "export"] as const;

export type RbacModule = (typeof RBAC_MODULES)[number];
export type RbacAction = (typeof RBAC_ACTIONS)[number];
export type PermissionCode = `${RbacModule}.${RbacAction}`;

export const SYSTEM_ROLES = [
  "owner",
  "admin",
  "gerente",
  "financeiro",
  "estoque",
  "vendas",
  "marketing",
  "atendimento",
  "visualizador",
] as const;

export type SystemRoleName = (typeof SYSTEM_ROLES)[number];
