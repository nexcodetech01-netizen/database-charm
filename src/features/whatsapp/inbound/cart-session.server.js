/**
 * Store PERSISTENTE das sessões de carrinho por conversa.
 *
 * FIX (2026-08-15): antes vivia só na memória do processo do servidor
 * (um `Map`) — em hospedagem serverless/edge, cada mensagem pode ser
 * atendida por uma instância diferente, sem memória compartilhada da
 * anterior, fazendo o carrinho "sumir" de forma imprevisível no meio de
 * uma conversa. Agora grava em `whatsapp_cart_sessions`, sobrevivendo
 * entre mensagens de forma confiável.
 *
 * Continua sem criar venda, sem reservar estoque, sem movimentar
 * financeiro/CRM — é só o estado da conversa, agora persistido.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CART_SESSION_TTL_MS, createCartSession, isCartSessionExpired, } from "./cart-session";
const TABLE = "whatsapp_cart_sessions";
/** Sessão viva da conversa, ou uma nova quando não existe / expirou. */
export async function getCartSession(companyId, phone, now = Date.now()) {
    const { data, error } = await supabaseAdmin
        .from(TABLE)
        .select("session_data")
        .eq("company_id", companyId)
        .eq("phone", phone)
        .maybeSingle();
    if (!error && data?.session_data) {
        const existing = data.session_data;
        if (!isCartSessionExpired(existing, now, CART_SESSION_TTL_MS))
            return existing;
    }
    const fresh = createCartSession(companyId, phone, now);
    await saveCartSession(fresh);
    return fresh;
}
export async function saveCartSession(session) {
    await supabaseAdmin.from(TABLE).upsert({
        company_id: session.companyId,
        phone: session.phone,
        session_data: session,
        updated_at: new Date().toISOString(),
    }, { onConflict: "company_id,phone" });
    return session;
}
export async function dropCartSession(companyId, phone) {
    await supabaseAdmin.from(TABLE).delete().eq("company_id", companyId).eq("phone", phone);
}
/** Apenas para testes: limpa todas as sessões (ambiente de teste usa mock do supabaseAdmin). */
export async function resetCartSessions() {
    await supabaseAdmin.from(TABLE).delete().neq("phone", "__never__");
}
