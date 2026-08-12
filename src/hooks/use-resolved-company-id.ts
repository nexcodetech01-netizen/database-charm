/**
 * useResolvedCompanyId — resolução da empresa ativa do usuário, no cliente.
 *
 * Espelha a mesma lógica de `src/lib/company-resolver.server.ts` (que é
 * server-only por convenção de bundling — ver comentário lá), para uso em
 * telas de configurações que fazem suas próprias queries diretas no
 * Supabase a partir do navegador.
 *
 * Corrige um bug real: várias seções de Configurações resolviam a empresa
 * apenas via `companies.owner_id = user.id` (a mais antiga que o usuário
 * é DONO), ignorando a empresa ativa/selecionada (`profiles.current_company_id`)
 * e o vínculo de equipe (`user_roles`). Isso fazia essas telas mostrarem/
 * editarem dados de uma empresa diferente da que o resto do app usa
 * (ex.: precificação, Bella IA) sempre que o usuário não é dono direto da
 * empresa ativa, ou tem mais de uma empresa vinculada.
 *
 * Ordem de resolução (idêntica ao helper server-side):
 *   1. `profiles.current_company_id` — só se houver vínculo real confirmado
 *   2. vínculo em `user_roles.company_id`
 *   3. propriedade em `companies.owner_id`
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function userHasCompanyAccess(userId: string, companyId: string): Promise<boolean> {
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

async function resolveCompanyIdClient(userId: string): Promise<string | null> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("current_company_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;

  const preferred = profile?.current_company_id as string | null | undefined;
  if (preferred && (await userHasCompanyAccess(userId, preferred))) {
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
  return (owned?.id as string) ?? null;
}

export function useResolvedCompanyId(userId: string | null | undefined) {
  const query = useQuery({
    queryKey: ["settings", "resolved-company-id", userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: () => resolveCompanyIdClient(userId as string),
  });

  return {
    companyId: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}
