import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Consome o nonce do `state` OAuth uma única vez (auditoria 04/10).
 *
 * O state é assinado e expira em 10 min, mas podia ser reapresentado
 * dentro desse prazo. Agora cada nonce é gravado na primeira vez; a
 * segunda tentativa bate na chave primária e é recusada.
 *
 * @returns true na primeira vez; false se o nonce já foi usado.
 */
export async function consumeOAuthNonce(
  nonce: string,
  userId: string,
  provider = "mercadolivre",
): Promise<boolean> {
  const table = supabaseAdmin.from("oauth_state_nonces" as never) as any;

  // Limpeza oportunista: nonces com mais de 1 dia não servem para nada.
  void table
    .delete()
    .lt("created_at", new Date(Date.now() - 86_400_000).toISOString())
    .then(() => undefined, () => undefined);

  const { error } = await (supabaseAdmin.from("oauth_state_nonces" as never) as any).insert({
    nonce,
    user_id: userId,
    provider,
  });
  if (!error) return true;
  if (error.code === "23505") return false; // já usado
  throw new Error(`Falha ao validar o state OAuth: ${error.message}`);
}
