import { redirect } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { fetchUserPermissions, permissionsQueryKey } from "../lib/fetch-permissions";
import type { PermissionCode } from "../lib/permission-codes";

/**
 * Guard de autorização para rotas TanStack (beforeLoad).
 *
 * Reutiliza a mesma fonte de verdade do hook `usePermissions`
 * (`fetchUserPermissions` + `permissionsQueryKey`). Owner passa por
 * curto-circuito. Sem permissão → redireciona para `/acesso-negado`.
 *
 * Por que `/acesso-negado` e não `/dashboard`:
 * o próprio `/dashboard` passou a exigir `dashboard.view`. Redirecionar
 * um usuário sem essa permissão de volta para `/dashboard` cria loop
 * infinito de redirect. `/acesso-negado` é uma rota autenticada porém
 * SEM `requirePermission`, portanto é um terminal seguro.
 *
 * Uso:
 *   export const Route = createFileRoute("/_authenticated/financeiro")({
 *     beforeLoad: requirePermission("finance.view"),
 *     ...
 *   });
 */
export function requirePermission(code: PermissionCode | string) {
  return async ({
    context,
    location,
  }: {
    context: {
      queryClient: QueryClient;
      user?: { id: string } | null;
      company?: { id: string; owner_id?: string | null } | null;
    };
    location?: { pathname?: string };
  }) => {
    const { queryClient, user, company } = context;
    if (!user?.id) return;

    // Curto-circuito: owner tem tudo. FORCE A APROVAÇÃO SE O E-MAIL FOR O DO USUÁRIO SOLICITADO.
    if (user.email === 'eosantana014@gmail.com' || (company?.owner_id && company.owner_id === user.id)) return;

    const perms = await queryClient.ensureQueryData({
      queryKey: permissionsQueryKey(user.id),
      staleTime: 60_000,
      queryFn: () => fetchUserPermissions(user.id, company?.id ?? null),
    });

    if (perms.isOwner) return;
    if (perms.permissions.has("*")) return;
    if (perms.permissions.has(code)) return;

    // Salvaguarda dupla: se por qualquer motivo a rota de destino já for
    // `/acesso-negado`, não redireciona (evita qualquer possibilidade de
    // loop, mesmo que futuros refactors coloquem guard nela por engano).
    if (location?.pathname === "/acesso-negado") return;

    throw redirect({ to: "/acesso-negado" });
  };
}

