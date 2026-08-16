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
import type { CartSession } from "./cart-session";
import type { CheckoutSession } from "./checkout-session";
import {
  COMMERCIAL_HANDOFF_MESSAGE,
  COMMERCIAL_INBOX_STATUS,
  buildCommercialTicketDraft,
  isConfirmationIntent,
  type CommercialTicketDraft,
} from "./commercial-inbox";
import { emitAgentEvent } from "../../bella-ai/agent/infrastructure/event-bus";
import { formatCurrency } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { makeSecurityContext } from "../../bella-ai/agent/infrastructure/context";

type Db = { from: (t: string) => any };

const TABLE = "whatsapp_commercial_inbox";

function toRow(draft: CommercialTicketDraft) {
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
export async function findOpenTicket(
  db: Db,
  companyId: string,
  phone: string,
): Promise<{ id: string } | null> {
  const { data } = await db
    .from(TABLE)
    .select("id")
    .eq("company_id", companyId)
    .eq("phone", phone)
    .eq("status", COMMERCIAL_INBOX_STATUS.waiting)
    .maybeSingle();
  return (data as { id: string } | null) ?? null;
}

export interface UpsertTicketResult {
  id: string | null;
  created: boolean;
}

/** Cria o atendimento ou atualiza o que já está aberto (sem duplicar). */
export async function upsertCommercialTicket(
  db: Db,
  draft: CommercialTicketDraft,
): Promise<UpsertTicketResult> {
  const existing = await findOpenTicket(db, draft.companyId, draft.phone);
  if (existing) {
    await db.from(TABLE).update(toRow(draft)).eq("id", existing.id);
    return { id: existing.id, created: false };
  }
  const { data } = await db.from(TABLE).insert(toRow(draft)).select("id").single();
  return { id: (data as { id: string } | null)?.id ?? null, created: true };
}

export interface CommercialConfirmationResult {
  text: string;
  ticketId: string | null;
  created: boolean;
  draft: CommercialTicketDraft;
}

/**
 * Cria o ticket no inbox comercial e dispara a notificação de "novo
 * pedido" (sino + som no topo do app). Extraído de
 * `handleCommercialConfirmationTurn` para ser chamado diretamente pelo
 * roteador assim que um pedido é confirmado — ver comentário em
 * `handleCommercialConfirmationTurn` sobre por que essa função sozinha
 * não é mais alcançada na prática.
 */
export async function recordConfirmedOrder(args: {
  db: Db;
  companyId: string;
  session: CheckoutSession;
  cart: CartSession;
  now?: number;
}): Promise<{ ticketId: string | null; created: boolean; draft: CommercialTicketDraft }> {
  const now = args.now ?? Date.now();
  const draft = buildCommercialTicketDraft({ session: args.session, cart: args.cart, now });
  const { id, created } = await upsertCommercialTicket(args.db, draft);

  if (created && id) {
    await emitAgentEvent({
      type: "catalog.order.received",
      ctx: {
        companyId: args.companyId,
        userId: "system",
        conversationId: args.session.phone,
        request: {
          requestId: `catalog-${id}`,
          channel: "whatsapp",
          startedAt: new Date(now),
        },
        security: makeSecurityContext(new Set(["*"]), true),
        supabase: supabase as any,
      },
      payload: {
        entityId: id,
        ticketId: id,
        buyerName: draft.buyerName,
        phone: draft.phone,
        total: draft.total,
        itemCount: draft.itemCount,
      },
      title: "Novo pedido do catálogo",
      description: `${draft.buyerName || "Cliente"} enviou um pedido de ${formatCurrency(draft.total)} (${draft.itemCount} itens).`,
    });
  }

  return { ticketId: id, created, draft };
}

/**
 * Confirmação do resumo → encaminha para a equipe.
 * Retorna `null` quando não há resumo aguardando confirmação
 * (ou a mensagem não é uma confirmação) — o fluxo normal segue.
 *
 * NOTA (2026-08-16): na prática, o roteador intercepta e responde a
 * qualquer confirmação de checkout ANTES de chegar aqui (bloco
 * "3c-pre" — prioridade máxima), então esta função dificilmente é
 * alcançada. A criação do ticket + notificação para o fluxo real
 * agora acontece via `recordConfirmedOrder`, chamada diretamente pelo
 * roteador quando `handleCheckoutTurn` retorna `confirmed: true`.
 * Mantida por compatibilidade, caso algum outro caminho a invoque.
 */
export async function handleCommercialConfirmationTurn(args: {
  db: Db;
  companyId: string;
  phone: string;
  text: string;
  session?: CheckoutSession | null;
  cart?: CartSession;
  now?: number;
}): Promise<CommercialConfirmationResult | null> {
  const now = args.now ?? Date.now();
  const session =
    args.session ?? (await peekCheckoutSession(args.companyId, args.phone, now));
  if (!session || session.step !== "summary") return null;
  if (!isConfirmationIntent(args.text)) return null;

  const cart = args.cart ?? (await getCartSession(args.companyId, args.phone, now));
  if (cart.items.length === 0) return null;

  const { ticketId: id, created, draft } = await recordConfirmedOrder({
    db: args.db,
    companyId: args.companyId,
    session,
    cart,
    now,
  });

  // Conversa encerrada: sessão e carrinho efêmeros são descartados.
  await dropCheckoutSession(args.companyId, args.phone);
  await saveCartSession(clearCartSession(cart, now));

  return { text: COMMERCIAL_HANDOFF_MESSAGE, ticketId: id, created, draft };
}
