/**
 * Store PERSISTENTE das sessões de fechamento por conversa (Sprint 6.8 —
 * Etapa 1; persistência corrigida em 2026-08-15).
 *
 * FIX (2026-08-15): antes vivia só na memória do processo do servidor —
 * em hospedagem serverless/edge, a resposta do cliente a uma pergunta do
 * fechamento (ex.: forma de pagamento) podia cair numa instância sem
 * memória da sessão em andamento, fazendo a mensagem "escapar" pra outro
 * sistema (achado real: resposta "Dinheiro" foi parar num handler de
 * saldo financeiro, sem relação com o pedido). Agora grava em
 * `whatsapp_checkout_sessions`, sobrevivendo entre mensagens de forma
 * confiável.
 *
 * Continua sem criar venda, sem criar orçamento, sem reservar estoque,
 * sem alterar financeiro/CRM/cadastro e sem chamar nenhum motor oficial
 * do ERP — é só o estado da conversa, agora persistido.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCartSession } from "./cart-session.server";
import { lookupCep } from "@/lib/cep.service";
import { EMPTY_CART_MESSAGE, PROMPTS, advanceCheckout, createCheckoutSession, isCheckoutIntent, isCheckoutSessionExpired, } from "./checkout-session";
const TABLE = "whatsapp_checkout_sessions";
/** Sessão viva de fechamento, ou `null` quando não existe / expirou. */
export async function peekCheckoutSession(companyId, phone, now = Date.now()) {
    const { data, error } = await supabaseAdmin
        .from(TABLE)
        .select("session_data")
        .eq("company_id", companyId)
        .eq("phone", phone)
        .maybeSingle();
    if (error || !data?.session_data)
        return null;
    const existing = data.session_data;
    return isCheckoutSessionExpired(existing, now) ? null : existing;
}
export async function saveCheckoutSession(session) {
    await supabaseAdmin.from(TABLE).upsert({
        company_id: session.companyId,
        phone: session.phone,
        session_data: session,
        updated_at: new Date().toISOString(),
    }, { onConflict: "company_id,phone" });
    return session;
}
export async function dropCheckoutSession(companyId, phone) {
    await supabaseAdmin.from(TABLE).delete().eq("company_id", companyId).eq("phone", phone);
}
/** Apenas para testes: limpa todas as sessões (ambiente de teste usa mock do supabaseAdmin). */
export async function resetCheckoutSessions() {
    await supabaseAdmin.from(TABLE).delete().neq("phone", "__never__");
}
const defaultCepResolver = async (cep) => {
    const found = await lookupCep(cep);
    return found
        ? {
            street: found.street,
            neighborhood: found.neighborhood,
            city: found.city,
            state: found.state,
        }
        : null;
};
/**
 * Resolve o turno de fechamento. Retorna `null` quando não há fluxo ativo
 * e a mensagem não é um pedido de fechamento — o fluxo normal segue.
 */
export async function handleCheckoutTurn(args) {
    const now = args.now ?? Date.now();
    const cart = args.cart ?? (await getCartSession(args.companyId, args.phone, now));
    const active = await peekCheckoutSession(args.companyId, args.phone, now);
    if (!active) {
        if (!isCheckoutIntent(args.text))
            return null;
        if (cart.items.length === 0) {
            return { text: EMPTY_CART_MESSAGE, session: null, step: null };
        }
        const fresh = await saveCheckoutSession(createCheckoutSession(args.companyId, args.phone, now));
        return { text: PROMPTS.buyer_name, session: fresh, step: fresh.step };
    }
    const result = await advanceCheckout({
        session: active,
        cart,
        text: args.text,
        now,
        resolveCep: args.resolveCep ?? defaultCepResolver,
    });
    if (result.session.step === "done") {
        await dropCheckoutSession(args.companyId, args.phone);
        return { text: result.text, session: null, step: null };
    }
    await saveCheckoutSession(result.session);
    return { text: result.text, session: result.session, step: result.session.step };
}
