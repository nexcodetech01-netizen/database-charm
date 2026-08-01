/**
 * Resolução da empresa ativa do usuário autenticado.
 *
 * Server-only e compartilhado: mantido FORA dos módulos `*.functions.ts`
 * porque o transform `tss-serverfn-split` remove declarações irmãs usadas
 * apenas dentro de handlers (gerando `ReferenceError` em runtime).
 *
 * SEGURANÇA (RC.0.2 — Multi-Tenant Hardening):
 * `profiles.current_company_id` é uma PREFERÊNCIA do usuário, não uma
 * credencial. Mesmo com o guard no banco, esta camada NUNCA devolve uma
 * empresa sem confirmar vínculo real (`user_roles` ou `companies.owner_id`).
 *
 * Ordem de resolução:
 *   1. `profiles.current_company_id` — apenas se houver vínculo real
 *   2. vínculo em `user_roles.company_id`
 *   3. propriedade em `companies.owner_id`
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type SB = SupabaseClient<Database>;

/** Erro de isolamento multiempresa (tenant boundary). */
export class CompanyAccessError extends Error {
  readonly code = "COMPANY_ACCESS_DENIED";
  constructor(message = "Empresa não vinculada ao usuário.") {
    super(message);
    this.name = "CompanyAccessError";
  }
}

/**
 * `true` quando o usuário é dono da empresa OU possui vínculo em
 * `user_roles`. Fonte da verdade: as mesmas tabelas usadas pela RLS
 * (`public.user_has_company_access`).
 */
export async function userHasCompanyAccess(
  supabase: SB,
  userId: string,
  companyId: string,
): Promise<boolean> {
  if (!userId || !companyId) return false;

  const { data: owned, error: ownedError } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (ownedError) throw ownedError;
  if (owned?.id) return true;

  const { data: membership, error: membershipError } = await supabase
    .from("user_roles")
    .select("company_id")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;

  return Boolean(membership?.company_id);
}

/**
 * Garante o vínculo antes de qualquer operação escopada por empresa.
 * Use sempre que o `companyId` vier de input do cliente ou de um campo
 * editável pelo usuário.
 */
export async function assertCompanyAccess(
  supabase: SB,
  userId: string,
  companyId: string,
): Promise<string> {
  const allowed = await userHasCompanyAccess(supabase, userId, companyId);
  if (!allowed) throw new CompanyAccessError();
  return companyId;
}

export async function resolveCompanyId(supabase: SB, userId: string): Promise<string> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("current_company_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;

  const preferred = profile?.current_company_id as string | null | undefined;
  if (preferred && (await userHasCompanyAccess(supabase, userId, preferred))) {
    return preferred;
  }

  const { data: membership, error: membershipError } = await supabase
    .from("user_roles")
    .select("company_id")
    .eq("user_id", userId)
    .not("company_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (membership?.company_id) return membership.company_id as string;

  const { data: owned, error: ownedError } = await supabase
    .from("companies")
    .select("id")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (ownedError) throw ownedError;
  if (owned?.id) return owned.id as string;

  throw new Error("Empresa não configurada para o usuário.");
}
