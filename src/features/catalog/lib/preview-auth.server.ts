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
  // RC.0.2: vínculo real (owner ou user_roles) — nunca
  // `profiles.current_company_id`, que é editável pelo usuário.
  const { data: owned } = await supabaseAdmin
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("owner_id", userId)
    .maybeSingle<{ id: string }>();

  if (owned?.id) return { ok: true, userId, companyId };

  const { data: membership } = await supabaseAdmin
    .from("user_roles")
    .select("company_id")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .limit(1)
    .maybeSingle<{ company_id: string }>();

  if (!membership?.company_id) return { ok: false, reason: "forbidden" };
  return { ok: true, userId, companyId };
}

function safeGetHeader(name: string): string | null {
  try {
    return getRequestHeader(name) ?? null;
  } catch {
    return null;
  }
}
