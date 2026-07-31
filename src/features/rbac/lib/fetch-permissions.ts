import { supabase } from "@/integrations/supabase/client";

export type PermissionsResult = {
  companyId: string | null;
  isOwner: boolean;
  permissions: Set<string>;
};

/**
 * Fonte única de verdade para carregar as permissões efetivas de um usuário
 * dentro de uma empresa. Usada pelo hook `usePermissions` (UI) e pelo
 * guard `requirePermission` (beforeLoad das rotas).
 *
 * Regras equivalentes ao SQL `public.has_permission()`:
 * - owner (companies.owner_id) recebe "*" (curto-circuito).
 * - demais usuários: união das permissões dos roles em user_roles.
 */
export async function fetchUserPermissions(
  userId: string | null | undefined,
  explicitCompanyId?: string | null,
): Promise<PermissionsResult> {
  if (!userId) {
    return { companyId: null, isOwner: false, permissions: new Set<string>() };
  }

  let companyId = explicitCompanyId ?? null;

  if (!companyId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("current_company_id")
      .eq("id", userId)
      .maybeSingle();
    companyId = profile?.current_company_id ?? null;
  }

  if (!companyId) {
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    companyId = company?.id ?? null;
  }

  if (!companyId) {
    return { companyId: null, isOwner: false, permissions: new Set<string>() };
  }

  const { data: ownedCompany } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("owner_id", userId)
    .maybeSingle();

  const isOwner = !!ownedCompany;
  if (isOwner) {
    return { companyId, isOwner: true, permissions: new Set<string>(["*"]) };
  }

  const { data: rows } = await supabase
    .from("user_roles")
    .select("role_id, role:roles(role_permissions(permissions(code)))")
    .eq("user_id", userId)
    .eq("company_id", companyId);

  type Row = {
    role:
      | {
          role_permissions:
            | Array<{ permissions: { code: string } | null }>
            | null;
        }
      | null;
  };
  const codes = new Set<string>();
  const rowsTyped = (rows ?? []) as unknown as Row[];
  rowsTyped.forEach((row) => {
    row.role?.role_permissions?.forEach((rp) => {
      if (rp.permissions?.code) codes.add(rp.permissions.code);
    });
  });

  return { companyId, isOwner: false, permissions: codes };
}

export const permissionsQueryKey = (userId: string | null | undefined) =>
  ["rbac", "permissions", userId ?? null] as const;
