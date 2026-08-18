import { parseWebsiteCatalogOrder, getGreeting } from "./intent-detector";
import { getCartSession, saveCartSession } from "./cart-session.server";
import { peekCheckoutSession, saveCheckoutSession, handleCheckoutTurn, dropCheckoutSession } from "./checkout-session.server";
import { createCheckoutSession, PROMPTS } from "./checkout-session";
import { parseCurrency } from "@/lib/masks";
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { recordConfirmedOrder } from "./commercial-inbox.server";
import { sendWhatsAppText } from "@/lib/whatsapp.server";

/**
 * NEXOS_ROUTER_BUILD_ID is used for runtime validation of the deployed bundle.
 * When you change the logic below, update this ID to match the deployment intent.
 */
export const NEXOS_ROUTER_BUILD_ID = "CFzzUNqT";

const phoneVariants = (waId: string) => [waId, waId.replace("@s.whatsapp.net", "")];

export async function handleWhatsAppInboundPayload({ db, msg, tenant, startedAt }: any) {
  const variants = phoneVariants(msg.waContactId);
  const canonical = variants.find((v) => v.startsWith("55") && v.length === 13) ?? msg.waContactId;

  // 1. Resolver/Criar Contato
  const { data: existingContacts } = await db
    .from("whatsapp_contacts")
    .select("id, wa_id")
    .eq("company_id", tenant.companyId)
    .in("wa_id", variants)
    .limit(1);

  let contactId;
  const existing = Array.isArray(existingContacts) ? existingContacts[0] : null;

  if (existing?.id) {
    contactId = existing.id;
    await db
      .from("whatsapp_contacts")
      .update({
        phone: existing.wa_id ?? canonical,
        profile_name: msg.profileName || "Cliente",
        last_seen_at: new Date(msg.timestamp).toISOString(),
        ultima_mensagem_cliente_at: new Date(msg.timestamp).toISOString(),
      })
      .eq("id", contactId);
  } else {
    const { data: created, error: createErr } = await db
      .from("whatsapp_contacts")
      .upsert(
        {
          company_id: tenant.companyId,
          wa_id: canonical,
          phone: canonical,
          profile_name: msg.profileName || "Cliente",
          last_seen_at: new Date(msg.timestamp).toISOString(),
          ultima_mensagem_cliente_at: new Date(msg.timestamp).toISOString(),
        },
        { onConflict: "company_id,wa_id" },
      )
      .select("id")
      .single();

    if (createErr || !created) {
      console.error("[whatsapp.inbound] falha ao criar contato:", createErr);
      return;
    }
    contactId = created.id;
  }

  // 2. Resolver/Criar Conversa
  const { data: existingConv } = await db
    .from("whatsapp_conversations")
    .select("id, status, unread_count, bella_state")
    .eq("company_id", tenant.companyId)
    .eq("contact_id", contactId)
    .maybeSingle();

  const currentStatus = existingConv?.status || "open";
  const newStatus =
    currentStatus === "resolved" ||
    currentStatus === "archived" ||
    currentStatus === "open" ||
    currentStatus === "bella"
      ? "open"
      : currentStatus;

  const { data: conversation } = await db
    .from("whatsapp_conversations")
    .upsert(
      {
        company_id: tenant.companyId,
        contact_id: contactId,
        last_inbound_at: new Date(msg.timestamp).toISOString(),
        ultima_mensagem_cliente_at: new Date(msg.timestamp).toISOString(),
        status: newStatus,
      },
      { onConflict: "company_id,contact_id" },
    )
    .select("id, bella_state, status, unread_count")
    .single();

  if (!conversation) return;
  const conversationId = conversation.id;
  const conversationStatus = String(conversation.status ?? "open");

  // 3. Persistir Mensagem e Dedup
  const { error: dedupErr } = await db.from("whatsapp_messages").insert({
    company_id: tenant.companyId,
    conversation_id: conversationId,
    contact_id: contactId,
    direction: "inbound",
    wa_message_id: msg.waMessageId,
    text: msg.text,
    payload: null,
    status: "received",
  });

  if (dedupErr && (dedupErr.code === "23505" || String(dedupErr.message ?? "").includes("duplicate"))) {
    return;
  }

  // Logs de Auditoria para o Problema do [PEDIDO-CATALOGO]
  console.log(`[AUDIT] MESSAGE_RECEIVED: id=${msg.waMessageId}, phone=${msg.phone}, text=${JSON.stringify(msg.text)}`);

  const isCatalogOrderMessage = msg.text.trim().startsWith("[PEDIDO-CATALOGO]");
    const websiteOrder = isCatalogOrderMessage ? parseWebsiteCatalogOrder(msg.text) : null;
    
    // Proteção de Integridade do Total (Recálculo)
    if (websiteOrder && websiteOrder.items.length > 0) {
      const calculatedSubtotal = websiteOrder.items.reduce((sum, item) => {
        return sum + (parseCurrency(item.price) * item.quantity);
      }, 0);
      
      const declaredTotal = parseCurrency(websiteOrder.total);
      
      if (Math.abs(declaredTotal - calculatedSubtotal) > 0.01) {
        console.warn(`[AUDIT] CATALOG_TOTAL_MISMATCH: declared=${declaredTotal}, calculated=${calculatedSubtotal}, items=${websiteOrder.items.length}`);
      }
    }
  console.log(`[AUDIT] CATALOG_DETECTION: isCatalogOrderMessage=${isCatalogOrderMessage}, websiteOrder=${!!websiteOrder}, item_count=${websiteOrder?.items?.length ?? 0}`);

  // PRIORIDADE MÁXIMA: Evento de sistema [PEDIDO-CATALOGO]
  if (isCatalogOrderMessage) {
    if (!websiteOrder || websiteOrder.items.length === 0) {
      console.error("[whatsapp.inbound] Falha ou pedido vazio em [PEDIDO-CATALOGO]:", msg.text);
      const errorText = "Recebi seu pedido do catálogo, mas não consegui identificar os itens. Por favor, tente enviar novamente ou aguarde um atendente. 😊";
      await sendWhatsAppText({ to: msg.phone, text: errorText });
      await db.from("whatsapp_conversations").update({ status: "human", updated_at: new Date().toISOString() }).eq("id", conversationId);
      console.log(`[AUDIT] CATALOG_EARLY_RETURN: failed_parse_or_empty`);
      return;
    }

    console.log(`[AUDIT] CATALOG_ORDER_PROCESSED: id=${msg.waMessageId}, phone=${msg.phone}`);

    // Inicia nova sessão limpa no estado de pagamento
    const freshSession = createCheckoutSession(tenant.companyId, msg.phone);
    freshSession.step = "WAITING_PAYMENT_METHOD";
    
    // Preservar o frete do catálogo
    if (websiteOrder.deliveryFee) {
      const fee = parseCurrency(websiteOrder.deliveryFee);
      freshSession.deliveryFee = fee;
      console.log(`[AUDIT] CATALOG_FREIGHT_PRESERVED: fee=${fee}`);
    } else if (websiteOrder.deliveryMethod === "tupa") {
      // Se for entrega em Tupã e não tiver taxa no catálogo, 
      // podemos assumir 0 se a política da loja for essa, mas para Tupã 
      // o usuário mencionou frete R$ 5,00 no Teste A.
      // Vou deixar nulo para ser explícito, ou 0 se for a regra.
      // A instrução diz "Não inventar valor de frete... Usar somente o valor realmente calculado".
      freshSession.deliveryFee = null;
    } else {
      freshSession.deliveryFee = null;
    }
    
    await saveCheckoutSession(freshSession);
    
    // Sincroniza itens
    const cartItems = websiteOrder.items.map(item => {
      const unitPrice = parseCurrency(item.price);
      return {
        productId: `catalog-${item.name}`,
        name: item.name,
        qty: item.quantity,
        unitPrice,
        subtotal: unitPrice * item.quantity
      };
    });
    
    // Validar preços
    if (cartItems.some(i => i.unitPrice <= 0)) {
      console.error("[AUDIT] Erro: Pedido com item sem preço detectado no catálogo", websiteOrder.items);
      const errorText = "Desculpe, não consegui processar o preço de alguns itens. Por favor, tente enviar novamente o pedido do catálogo. 😊";
      await sendWhatsAppText({ to: msg.phone, text: errorText });
      return;
    }
    const cart = {
      companyId: tenant.companyId,
      phone: msg.phone,
      items: cartItems,
      total: cartItems.reduce((sum, i) => sum + i.subtotal, 0),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await saveCartSession(cart);

    // Preencher nome se disponível no pedido do catálogo
    if (websiteOrder.buyerName) {
      freshSession.customer.fullName = websiteOrder.buyerName;
      // sync buyerName to session root as well for legacy compatibility
      freshSession.buyerName = websiteOrder.buyerName;
      await saveCheckoutSession(freshSession);
    }

    // O router apenas inicializa a sessão e envia o prompt inicial.
    // NÃO chamamos handleCheckoutTurn aqui para evitar o bug de processamento de texto vazio.
    const greeting = getGreeting();
    const welcomePrompt = `${greeting}\n\nRecebi seu pedido do catálogo! 🛍️\n\n${PROMPTS.WAITING_PAYMENT_METHOD}`;
    
    const sent = await sendWhatsAppText({ to: msg.phone, text: welcomePrompt });
    
    await db.from("whatsapp_messages").insert({
      company_id: tenant.companyId,
      conversation_id: conversationId,
      contact_id: contactId,
      direction: "outbound",
      wa_message_id: sent.waMessageId,
      text: welcomePrompt,
      status: sent.ok ? "sent" : "failed",
      provider: "catalog-nav",
      skill_id: "catalog.new_order"
    });

    console.log(`[AUDIT] CATALOG_EARLY_RETURN: success`);
    return;
  }

  // 4. Fluxo de Checkout (Conversacional)
  if (conversationStatus === "human" || conversationStatus === "resolved" || conversationStatus === "archived") {
    return;
  }

  console.log(`[AUDIT] BEFORE_HANDLE_CHECKOUT: id=${msg.waMessageId}, isCatalogOrderMessage=${isCatalogOrderMessage}, text=${msg.text}`);
  const checkoutTurn = await handleCheckoutTurn({
    companyId: tenant.companyId,
    phone: msg.phone,
    text: msg.text,
  });

  if (checkoutTurn) {
    const checkoutSent = await sendWhatsAppText({ to: msg.phone, text: checkoutTurn.text });
    await db.from("whatsapp_messages").insert({
      company_id: tenant.companyId,
      conversation_id: conversationId,
      contact_id: contactId,
      direction: "outbound",
      wa_message_id: checkoutSent.waMessageId,
      text: checkoutTurn.text,
      status: checkoutSent.ok ? "sent" : "failed",
      provider: "catalog-nav",
      skill_id: "catalog.checkout"
    });
    
    if (checkoutTurn.confirmed && checkoutTurn.completedSession) {
      const currentCart = await getCartSession(tenant.companyId, msg.phone);
      await recordConfirmedOrder({
        db,
        companyId: tenant.companyId,
        session: checkoutTurn.completedSession,
        cart: currentCart
      });
    }
    return;
  }
}
