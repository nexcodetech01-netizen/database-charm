/**
 * Inbox Comercial — persistência do atendimento (Sprint 6.8 — Etapa 2).
 *
 * Grava SOMENTE em `whatsapp_commercial_inbox` (tabela própria do inbox).
 * NÃO cria venda, NÃO cria orçamento, NÃO movimenta estoque, NÃO gera
 * financeiro, NÃO altera CRM/cadastro e NÃO chama `create_sale()` nem
 * qualquer motor oficial do ERP.
 */
import { clearCartSession } from "./cart-session";
import { getCartSession, saveCartSession } from "./cart-session.server";
import { dropCheckoutSession, peekCheckoutSession } from "./checkout-session.server";
import { COMMERCIAL_HANDOFF_MESSAGE, COMMERCIAL_INBOX_STATUS, buildCommercialTicketDraft, isConfirmationIntent, } from "./commercial-inbox";
const TABLE = "whatsapp_commercial_inbox";
function toRow(draft) {
    return {
        company_id: draft.companyId,
        phone: draft.phone,
        buyer_name: draft.buyerName,
        items: draft.items,
        item_count: draft.itemCount,
        total: draft.total,
        fulfillment: draft.fulfillment,
        delivery: draft.delivery,
        payment: draft.payment,
        origin: draft.origin,
        status: draft.status,
        full_name: draft.customer.fullName,
        person_type: draft.customer.personType,
        cpf: draft.customer.cpf,
        cnpj: draft.customer.cnpj,
        birth_date: draft.customer.birthDate,
        zip_code: draft.customer.zipCode,
        state: draft.customer.state,
        city: draft.customer.city,
        district: draft.customer.district,
        street: draft.customer.street,
        number: draft.customer.number,
        complement: draft.customer.complement,
    };
}
/** Atendimento aberto (aguardando) para o telefone, se existir. */
export async function findOpenTicket(db, companyId, phone) {
    const { data } = await db
        .from(TABLE)
        .select("id")
        .eq("company_id", companyId)
        .eq("phone", phone)
        .eq("status", COMMERCIAL_INBOX_STATUS.waiting)
        .maybeSingle();
    return data ?? null;
}
/** Cria o atendimento ou atualiza o que já está aberto (sem duplicar). */
export async function upsertCommercialTicket(db, draft) {
    const existing = await findOpenTicket(db, draft.companyId, draft.phone);
    if (existing) {
        await db.from(TABLE).update(toRow(draft)).eq("id", existing.id);
        return { id: existing.id, created: false };
    }
    const { data } = await db.from(TABLE).insert(toRow(draft)).select("id").single();
    return { id: data?.id ?? null, created: true };
}
/**
 * Confirmação do resumo → encaminha para a equipe.
 * Retorna `null` quando não há resumo aguardando confirmação
 * (ou a mensagem não é uma confirmação) — o fluxo normal segue.
 */
export async function handleCommercialConfirmationTurn(args) {
    const now = args.now ?? Date.now();
    const session = args.session ?? (await peekCheckoutSession(args.companyId, args.phone, now));
    if (!session || session.step !== "summary")
        return null;
    if (!isConfirmationIntent(args.text))
        return null;
    const cart = args.cart ?? (await getCartSession(args.companyId, args.phone, now));
    if (cart.items.length === 0)
        return null;
    const draft = buildCommercialTicketDraft({ session, cart, now });
    const { id, created } = await upsertCommercialTicket(args.db, draft);
    // Conversa encerrada: sessão e carrinho efêmeros são descartados.
    await dropCheckoutSession(args.companyId, args.phone);
    await saveCartSession(clearCartSession(cart, now));
    return { text: COMMERCIAL_HANDOFF_MESSAGE, ticketId: id, created, draft };
}
