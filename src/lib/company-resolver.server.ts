/**
 * Resolução da empresa ativa do usuário autenticado.
 *
 * Server-only e compartilhado: mantido FORA dos módulos `*.functions.ts`
 * porque o transform `tss-serverfn-split` remove declarações irmãs usadas
 * apenas dentro de handlers (gerando `ReferenceError` em runtime).
 *
 * Ordem de resolução (mecanismo vigente do projeto):
 *   1. `profiles.current_company_id`
 *   2. vínculo em `user_roles.company_id`
 *   3. propriedade em `companies.owner_id`
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type SB = SupabaseClient<Database>;

export async function resolveCompanyId(supabase: SB, userId: string): Promise<string> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("current_company_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (profile?.current_company_id) return profile.current_company_id as string;

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
