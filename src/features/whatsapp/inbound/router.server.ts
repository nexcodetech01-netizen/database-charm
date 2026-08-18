import { parseWebsiteCatalogOrder } from "./intent-detector";
import { getCartSession, setProductQuantity } from "./cart-session.server";
import { createCheckoutSession, handleCheckoutTurn } from "./checkout-session.server";
import { sendWhatsAppText } from "./whatsapp.server";
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { recordConfirmedOrder } from "./commercial-inbox.server";

// Função para formatar saudações baseada na hora
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Bom dia!";
  if (hour >= 12 && hour < 18) return "Boa tarde!";
  return "Boa noite!";
};

// Detecção simples de intenção de compra e dados (conforme router.server.ts)
const isPurchaseIntent = (text: string) => /quero|comprar|gostei|valor|preço|quanto/i.test(text);
const isDataSubmissionIntent = (text: string) => /cpf|endereço|cep|rua|pix|cartão|dinheiro/i.test(text);
const detectPaymentMethod = (text: string) => {
  if (/pix/i.test(text)) return "pix";
  if (/cartão|cartao/i.test(text)) return "card";
  if (/dinheiro/i.test(text)) return "money";
  return null;
};

// Mock de phoneVariants
const phoneVariants = (waId: string) => [waId, waId.replace("@s.whatsapp.net", "")];

/**
 * Roteador Inbound Principal para WhatsApp
 * 
 * Este arquivo centraliza a lógica de decisão para mensagens recebidas.
 * Prioridade:
 * 1. Eventos de sistema ([PEDIDO-CATALOGO])
 * 2. Fluxo de Checkout Ativo
 * 3. Detecção de Intenções (Compra, Dúvidas, etc)
 * 4. Bella AI (Fallback)
 */
export async function processOneMessage({ db, msg, tenant, startedAt }) {
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

  console.log("[whatsapp.inbound] conversa resolvida", {
    from: msg.phone,
    canonical,
    companyId: tenant.companyId,
    contactId,
    conversationId,
    status: conversationStatus,
    body: msg.text,
  });

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
    console.log(
      JSON.stringify({
        scope: "whatsapp.inbound",
        level: "info",
        msg: "duplicado ignorado",
        waMessageId: msg.waMessageId,
      }),
    );
    return;
  }

  // Logs de Auditoria para o Problema do [PEDIDO-CATALOGO]
  console.log(`[AUDIT-LOG] Versão: ${process.env.VITE_APP_VERSION || "N/A"} - Commit: 49d18947`);
  console.log(`[AUDIT-LOG] Mensagem bruta: "${msg.text}"`);
  console.log(`[AUDIT-LOG] JSON: ${JSON.stringify(msg.text)}`);
  console.log(`[AUDIT-LOG] CharCodes: ${Array.from(msg.text.slice(0, 20)).map(c => c.charCodeAt(0)).join(",")}`);

  // 3c-pre-ante) Resumo de pedido colado a partir do catálogo do site
  const isCatalogOrderMessage = msg.text.trimStart().startsWith("[PEDIDO-CATALOGO]");
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
    await createCheckoutSession(tenant.companyId, msg.phone);
    
    // Sincroniza itens
    for (const item of websiteOrder.items) {
      await setProductQuantity(tenant.companyId, msg.phone, item.name, item.quantity);
    }

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
  // Se a conversa estiver sob operador, Bella pausa.
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
    return;
  }

  // 5. Handlers Legados e IA (Simplificado para o audit)
  // ... resto da lógica de intents ...
}
