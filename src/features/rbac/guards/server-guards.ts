/**
 * RBAC server-side — a única barreira de autorização que o cliente não
 * consegue contornar (junto com a RLS).
 *
 * `requirePermission` (guards/require-permission.ts) protege apenas o
 * roteamento no browser: um usuário autenticado pode chamar a Server
 * Function diretamente. Este módulo fecha essa lacuna.
 *
 * Uso dentro de um `createServerFn().middleware([requireSupabaseAuth])`:
 *
 *   .handler(async ({ context }) => {
 *     const { companyId } = await requireServerPermission(context, "finance.create", {
 *       action: "finance.transaction.create",
 *       module: "finance",
 *     });
 *     ...
 *   });
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { resolveCompanyId } from "@/lib/company-resolver.server";
import { recordAudit } from "@/lib/audit.server";
import type { PermissionCode } from "../lib/permission-codes";

type SB = SupabaseClient<Database>;

export interface ServerAuthContext {
  readonly supabase: SB;
  readonly userId: string;
}

export interface ServerPermissionOptions {
  /** Empresa alvo. Default: empresa ativa do usuário. */
  readonly companyId?: string | null;
  /** Rótulo da operação para a trilha de auditoria. */
  readonly action?: string;
  /** Módulo lógico (products, finance, fiscal…). */
  readonly module?: string;
  /** Registra também os acessos permitidos (default: só nega). */
  readonly auditSuccess?: boolean;
}

export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN";
  constructor(permission: string) {
    super(`Acesso negado: permissão "${permission}" é necessária.`);
    this.name = "ForbiddenError";
  }
}

/** true quando o usuário possui a permissão na empresa informada. */
export async function hasServerPermission(
  supabase: SB,
  userId: string,
  companyId: string,
  code: PermissionCode | string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_permission", {
    _user_id: userId,
    _company_id: companyId,
    _permission_code: code,
  });
  if (error) throw error;
  return data === true;
}

/**
 * Garante a permissão e devolve a empresa resolvida.
 * Nega → `ForbiddenError` + registro `denied` na trilha de auditoria.
 */
export async function requireServerPermission(
  context: ServerAuthContext,
  code: PermissionCode | string,
  options: ServerPermissionOptions = {},
): Promise<{ companyId: string }> {
  const { supabase, userId } = context;
  const companyId = options.companyId ?? (await resolveCompanyId(supabase, userId));

  const allowed = await hasServerPermission(supabase, userId, companyId, code);
  const action = options.action ?? `permission.${code}`;
  const auditModule = options.module ?? String(code).split(".")[0] ?? "core";

  if (!allowed) {
    await recordAudit(supabase, {
      companyId,
      action,
      module: auditModule,
      result: "denied",
      error: `missing_permission:${code}`,
      after: { permission: code },
    });
    throw new ForbiddenError(String(code));
  }

  if (options.auditSuccess) {
    await recordAudit(supabase, {
      companyId,
      action,
      module: auditModule,
      result: "success",
      after: { permission: code },
    });
  }

  return { companyId };
}

/** Variante para quando qualquer uma das permissões basta. */
export async function requireAnyServerPermission(
  context: ServerAuthContext,
  codes: ReadonlyArray<PermissionCode | string>,
  options: ServerPermissionOptions = {},
): Promise<{ companyId: string }> {
  const { supabase, userId } = context;
  const companyId = options.companyId ?? (await resolveCompanyId(supabase, userId));

  for (const code of codes) {
    if (await hasServerPermission(supabase, userId, companyId, code)) {
      return { companyId };
    }
  }

  await recordAudit(supabase, {
    companyId,
    action: options.action ?? `permission.${codes.join("|")}`,
    module: options.module ?? "core",
    result: "denied",
    error: `missing_permission:${codes.join("|")}`,
  });
  throw new ForbiddenError(codes.join(" ou "));
}
