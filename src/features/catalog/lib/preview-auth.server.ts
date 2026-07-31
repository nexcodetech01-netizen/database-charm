/**
 * Preview do catálogo — verificação de autorização.
 *
 * Uma coleção `scheduled` só pode ser exibida via `?preview=1` se o chamador
 * for um usuário autenticado da MESMA empresa dona da coleção.
 *
 * A rota HTTP público-facing (`/api/public/catalog/*`) ativa preview quando
 * o cliente encaminha um Authorization Bearer válido (o auth-attacher já faz
 * isso automaticamente em navegações client-side de usuários logados).
 * Requisições anônimas nunca conseguem enxergar `scheduled`.
 */
import { getRequestHeader } from "@tanstack/react-start/server";
import type { supabaseAdmin as SupabaseAdminType } from "@/integrations/supabase/client.server";

type SupabaseAdmin = typeof SupabaseAdminType;

export type PreviewAuthResult =
  | { ok: true; userId: string; companyId: string }
  | { ok: false; reason: "no_token" | "invalid_token" | "no_company" | "forbidden" };

/**
 * Valida o Authorization Bearer e confirma que o usuário pertence
 * à empresa `companyId`. Não lança — devolve tag para o chamador decidir.
 */
export async function authorizePreview(
  supabaseAdmin: SupabaseAdmin,
  companyId: string,
): Promise<PreviewAuthResult> {
  const authHeader = safeGetHeader("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, reason: "no_token" };
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token || token.split(".").length !== 3) {
    return { ok: false, reason: "invalid_token" };
  }

  const { data: userData, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !userData?.user) return { ok: false, reason: "invalid_token" };

  const userId = userData.user.id;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("current_company_id")
    .eq("id", userId)
    .maybeSingle<{ current_company_id: string | null }>();

  if (!profile?.current_company_id) return { ok: false, reason: "no_company" };
  if (profile.current_company_id !== companyId) {
    return { ok: false, reason: "forbidden" };
  }
  return { ok: true, userId, companyId };
}

function safeGetHeader(name: string): string | null {
  try {
    return getRequestHeader(name) ?? null;
  } catch {
    return null;
  }
}
