import { parseWebsiteCatalogOrder } from "./intent-detector";
import { getCartSession, saveCartSession } from "./cart-session.server";
import { peekCheckoutSession, saveCheckoutSession, handleCheckoutTurn, dropCheckoutSession } from "./checkout-session.server";
import { createCheckoutSession } from "./checkout-session";
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { recordConfirmedOrder } from "./commercial-inbox.server";
import { sendWhatsAppText } from "./whatsapp.server-C84o1Tlj";

// Função para formatar saudações baseada na hora
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Bom dia!";
  if (hour >= 12 && hour < 18) return "Boa tarde!";
  return "Boa noite!";
};

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
  console.log(`[AUDIT-LOG] Mensagem bruta: "${msg.text}"`);
  console.log(`[AUDIT-LOG] JSON: ${JSON.stringify(msg.text)}`);
  console.log(`[AUDIT-LOG] CharCodes: ${Array.from(msg.text.slice(0, 20)).map(c => c.charCodeAt(0)).join(",")}`);

  const isCatalogOrderMessage = msg.text.trim().startsWith("[PEDIDO-CATALOGO]");
  console.log(`[AUDIT-LOG] isCatalogOrderMessage: ${isCatalogOrderMessage}`);

  // PRIORIDADE MÁXIMA: Evento de sistema [PEDIDO-CATALOGO]
  if (isCatalogOrderMessage) {
    const websiteOrder = parseWebsiteCatalogOrder(msg.text);

    if (!websiteOrder || websiteOrder.items.length === 0) {
      console.error("[whatsapp.inbound] Falha ou pedido vazio em [PEDIDO-CATALOGO]:", msg.text);
      const errorText = "Recebi seu pedido do catálogo, mas não consegui identificar os itens. Por favor, tente enviar novamente ou aguarde um atendente. 😊";
      await sendWhatsAppText({ to: msg.phone, text: errorText });
      await db.from("whatsapp_conversations").update({ status: "human", updated_at: new Date().toISOString() }).eq("id", conversationId);
      return;
    }

    // Inicia nova sessão limpa
    const freshSession = createCheckoutSession(tenant.companyId, msg.phone);
    await saveCheckoutSession(freshSession);
    
    // Sincroniza itens
    const cart = {
      companyId: tenant.companyId,
      phone: msg.phone,
      items: websiteOrder.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price || 0
      })),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await saveCartSession(cart);

    // Pergunta Pagamento imediatamente
    const replyText = `${getGreeting()}\n\nRecebi seu pedido do catálogo! 🛍️\n\nComo você prefere pagar: Pix, Cartão ou Dinheiro?`;
    const sent = await sendWhatsAppText({ to: msg.phone, text: replyText });

    await db.from("whatsapp_messages").insert({
      company_id: tenant.companyId,
      conversation_id: conversationId,
      contact_id: contactId,
      direction: "outbound",
      wa_message_id: sent.waMessageId,
      text: replyText,
      status: sent.ok ? "sent" : "failed",
      provider: "catalog-nav",
      skill_id: "catalog.new_order"
    });

    return;
  }

  // 4. Fluxo de Checkout (Conversacional)
  if (conversationStatus === "human" || conversationStatus === "resolved" || conversationStatus === "archived") {
    return;
  }

  console.log(`[AUDIT-LOG] Chamando handleCheckoutTurn para: "${msg.text}"`);
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
      await recordConfirmedOrder({
        db,
        companyId: tenant.companyId,
        phone: msg.phone,
        session: checkoutTurn.completedSession
      });
    }
    return;
  }
}
