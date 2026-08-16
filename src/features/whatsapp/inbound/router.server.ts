/**
 * WhatsApp inbound router — server-only.
 *
 * Fio único que conecta a Meta Cloud API à Bella IA já existente.
 * NÃO altera Skills, Providers, Services, Gateway ou Action Engine —
 * apenas os orquestra na ordem correta e persiste histórico.
 *
 * Fluxo por mensagem:
 *   parse → dedupe → resolve tenant → contact/conversation upsert →
 *   persist inbound → restore Bella context → run engine → (fallback AI Gateway
 *   se UNKNOWN) → sendWhatsAppText → persist outbound → snapshot Bella state.
 */
import { BellaActionEngine } from "@/features/bella-ai/actions";
import { bellaConversationManager } from "@/features/bella-ai/context";
import type { BellaConversationPatch } from "@/features/bella-ai/context/types";
import type { BellaActionResponse } from "@/features/bella-ai/actions/types";
import { bellaAIGateway } from "@/features/bella-ai/ai/gateway";
import { sendWhatsAppText, sendWhatsAppImage } from "@/lib/whatsapp.server";
import { handleCatalogTurn } from "./catalog-nav.server";
import { handlePhotoTurn } from "./product-photos.server";
import { handleRecommendationTurn } from "./product-recommendations.server";
import { handleUpsellTurn } from "./product-upsell.server";
import { handleCheckoutTurn, saveCheckoutSession } from "./checkout-session.server";
import { createCheckoutSession, PROMPTS } from "./checkout-session";
import { getCartSession, saveCartSession } from "./cart-session.server";
import { addProduct, clearCartSession } from "./cart-session";
import { handleCommercialConfirmationTurn, recordConfirmedOrder } from "./commercial-inbox.server";
import { getGreeting, parseCatalogProductIntent, isPurchaseIntent, isDataSubmissionIntent, detectPaymentMethod, parseWebsiteCatalogOrder } from "./intent-detector";
import type { CatalogNavState } from "./catalog-nav";
import { isCatalogIntent } from "./catalog-nav";


type Any = Record<string, unknown>;

/** Locks in-memory por contato — serializa requisições concorrentes do mesmo WA id. */
const contactLocks = new Map<string, Promise<unknown>>();
function withContactLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = contactLocks.get(key) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  contactLocks.set(
    key,
    next.finally(() => {
      if (contactLocks.get(key) === next) contactLocks.delete(key);
    }),
  );
  return next;
}

interface ParsedTextMessage {
  waMessageId: string;
  waContactId: string;
  phone: string;
  profileName: string | null;
  timestamp: number;
  text: string;
  phoneNumberId: string;
}

/**
 * Gera variantes de um número BR com e sem o 9º dígito de celular.
 * A Meta pode entregar o mesmo contato ora como "5511987654321" ora como
 * "551187654321" — normalizamos para casar com o contato existente.
 */
function phoneVariants(raw: string): string[] {
  const digits = String(raw ?? "").replace(/\D/g, "");
  const set = new Set<string>();
  if (!digits) return [];
  set.add(digits);

  // Normalização para o 9º dígito brasileiro
  // Se o número tem 12 ou 13 dígitos e começa com 55 (Brasil)
  if (digits.startsWith("55")) {
    const cc = "55";
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);

    if (rest.length === 9 && rest.startsWith("9")) {
      // Tem 9 dígitos (ex: 55 11 987654321), adiciona variante com 8 (55 11 87654321)
      set.add(`${cc}${ddd}${rest.slice(1)}`);
    } else if (rest.length === 8) {
      // Tem 8 dígitos (ex: 55 11 87654321), adiciona variante com 9 (55 11 987654321)
      set.add(`${cc}${ddd}9${rest}`);
    }
    
    // Fallback agressivo: últimos 8 dígitos para comparação de contato
    if (digits.length >= 8) {
      const suffix = digits.slice(-8);
      // Aqui poderíamos adicionar mais variantes se a busca permitisse regex, 
      // mas o set ajuda o .in() do Supabase
    }
  }
  return Array.from(set);
}


function parseInboundPayload(payload: Any): ParsedTextMessage[] {
  const out: ParsedTextMessage[] = [];
  const entries = (payload?.entry ?? []) as Any[];
  for (const entry of entries) {
    const changes = (entry?.changes ?? []) as Any[];
    for (const change of changes) {
      if (change?.field !== "messages") continue;
      const value = (change?.value ?? {}) as Any;
      const meta = (value?.metadata ?? {}) as Any;
      const phoneNumberId = String(meta?.phone_number_id ?? "");
      const contacts = (value?.contacts ?? []) as Any[];
      const nameByWaId = new Map<string, string>();
      for (const c of contacts) {
        const waId = String((c as Any)?.wa_id ?? "");
        const profile = ((c as Any)?.profile ?? {}) as Any;
        const name = typeof profile?.name === "string" ? (profile.name as string) : "";
        if (waId) nameByWaId.set(waId, name);
      }
      const messages = (value?.messages ?? []) as Any[];
      for (const m of messages) {
        if ((m as Any)?.type !== "text") continue;
        const textObj = ((m as Any)?.text ?? {}) as Any;
        const body = typeof textObj?.body === "string" ? (textObj.body as string).trim() : "";
        if (!body) continue;
        const waMessageId = String((m as Any)?.id ?? "");
        const from = String((m as Any)?.from ?? "");
        if (!waMessageId || !from || !phoneNumberId) continue;
        out.push({
          waMessageId,
          waContactId: from,
          phone: from,
          profileName: nameByWaId.get(from) ?? null,
          timestamp: Number((m as Any)?.timestamp ?? 0) * 1000 || Date.now(),
          text: body,
          phoneNumberId,
        });
      }
    }
  }
  return out;
}

function formatBellaResponse(r: BellaActionResponse): string {
  const parts: string[] = [];
  const greeting = getGreeting();
  parts.push(greeting);
  parts.push(""); // Linha em branco após saudação
  
  if (r.title && r.title !== "Ação executada") parts.push(`*${r.title}*`);
  if (r.description) parts.push(r.description);
  if (r.metrics?.length) {
    for (const m of r.metrics.slice(0, 6) as unknown as Any[]) {
      const label = m?.label ?? m?.name ?? "";
      const value = m?.value ?? "";
      if (label && value !== undefined) parts.push(`• ${String(label)}: ${String(value)}`);
    }
  }
  if (r.suggestions?.length) {
    parts.push("");
    parts.push("_Sugestões:_");
    for (const s of r.suggestions.slice(0, 3)) parts.push(`› ${s.title}`);
  }
  return parts.join("\n").trim() || "Ok.";
}

interface ParsedStatusEvent {
  waMessageId: string;
  status: string; // sent | delivered | read | failed
  timestamp: number;
  phoneNumberId: string;
  recipientId: string | null;
  errorCode: number | null;
  errorTitle: string | null;
  errorMessage: string | null;
  errorDetails: string | null;
  raw: Any;
}

function parseStatusEvents(payload: Any): ParsedStatusEvent[] {
  const out: ParsedStatusEvent[] = [];
  const entries = (payload?.entry ?? []) as Any[];
  for (const entry of entries) {
    const changes = (entry?.changes ?? []) as Any[];
    for (const change of changes) {
      if (change?.field !== "messages") continue;
      const value = (change?.value ?? {}) as Any;
      const meta = (value?.metadata ?? {}) as Any;
      const phoneNumberId = String(meta?.phone_number_id ?? "");
      const statuses = (value?.statuses ?? []) as Any[];
      for (const s of statuses) {
        const waMessageId = String((s as Any)?.id ?? "");
        const status = String((s as Any)?.status ?? "");
        if (!waMessageId || !status) continue;
        const errors = ((s as Any)?.errors ?? []) as Any[];
        const err0 = (errors[0] ?? null) as Any | null;
        const errData = (err0?.error_data ?? {}) as Any;
        out.push({
          waMessageId,
          status,
          timestamp: Number((s as Any)?.timestamp ?? 0) * 1000 || Date.now(),
          phoneNumberId,
          recipientId: (s as Any)?.recipient_id ? String((s as Any).recipient_id) : null,
          errorCode: err0?.code != null ? Number(err0.code) : null,
          errorTitle: err0?.title ? String(err0.title) : null,
          errorMessage: err0?.message ? String(err0.message) : null,
          errorDetails: errData?.details ? String(errData.details) : null,
          raw: s,
        });
      }
    }
  }
  return out;
}

async function processStatusEvents(
  db: { from: (t: string) => any },
  events: ParsedStatusEvent[],
): Promise<void> {
  for (const ev of events) {
    try {
      if (ev.status === "failed" || ev.errorCode != null) {
        console.error("[whatsapp.status] falha da Meta", {
          waMessageId: ev.waMessageId,
          status: ev.status,
          phoneNumberId: ev.phoneNumberId,
          recipientId: ev.recipientId,
          errorCode: ev.errorCode,
          errorTitle: ev.errorTitle,
          errorMessage: ev.errorMessage,
          errorDetails: ev.errorDetails,
        });
      } else {
        console.log("[whatsapp.status] evento recebido", {
          waMessageId: ev.waMessageId,
          status: ev.status,
          phoneNumberId: ev.phoneNumberId,
        });
      }

      // Resolve empresa pelo phone_number_id para escopar o update.
      let companyId: string | null = null;
      if (ev.phoneNumberId) {
        const { data: company } = await db
          .from("companies")
          .select("id")
          .eq("whatsapp_phone_number_id", ev.phoneNumberId)
          .maybeSingle();
        companyId = company?.id ? (company.id as string) : null;
      }

      const errorText = ev.errorCode != null || ev.errorMessage
        ? [
            ev.errorCode != null ? `code=${ev.errorCode}` : null,
            ev.errorTitle,
            ev.errorMessage,
            ev.errorDetails,
          ]
            .filter(Boolean)
            .join(" | ")
        : null;

      const updatePayload: Record<string, unknown> = { status: ev.status };
      if (errorText) updatePayload.error = errorText;

      let updateQuery = db
        .from("whatsapp_messages")
        .update(updatePayload)
        .eq("wa_message_id", ev.waMessageId);
      if (companyId) updateQuery = updateQuery.eq("company_id", companyId);
      const { error: updErr } = await updateQuery;
      if (updErr) {
        console.error("[whatsapp.status] update falhou", {
          waMessageId: ev.waMessageId,
          error: updErr.message ?? String(updErr),
        });
      }

      // Registro de auditoria agregado (best-effort).
      if (companyId) {
        await db.from("whatsapp_message_events").insert({
          company_id: companyId,
          direction: "outbound",
          wa_message_id: ev.waMessageId,
          status: ev.status,
          sent_at: new Date(ev.timestamp).toISOString(),
        });
      }
    } catch (err) {
      console.error("[whatsapp.status] erro processando evento", {
        waMessageId: ev.waMessageId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export async function handleWhatsAppInboundPayload(payload: Any): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as {
    from: (t: string) => any;
  };

  const statusEvents = parseStatusEvents(payload);
  if (statusEvents.length > 0) {
    console.log("[whatsapp.inbound] status events", { count: statusEvents.length });
    await processStatusEvents(db, statusEvents);
  }

  const messages = parseInboundPayload(payload);
  console.log("[whatsapp.inbound] payload recebido", {
    entries: Array.isArray((payload as Any)?.entry) ? ((payload as Any).entry as unknown[]).length : 0,
    textMessages: messages.length,
    statusEvents: statusEvents.length,
  });
  if (messages.length === 0) return;


  // Cache tenant lookup por phone_number_id dentro da mesma entrega.
  const tenantCache = new Map<string, { companyId: string; companyName: string | null } | null>();

  for (const msg of messages) {
    const started = Date.now();
    console.log("[whatsapp.inbound] mensagem recebida", {
      from: msg.phone,
      variants: phoneVariants(msg.phone),
      phoneNumberId: msg.phoneNumberId,
      waMessageId: msg.waMessageId,
      body: msg.text,
    });
    try {

    let tenant = tenantCache.get(msg.phoneNumberId);
      if (tenant === undefined) {
        const { data: company } = await db
          .from("companies")
          .select("id, name")
          .eq("whatsapp_phone_number_id", msg.phoneNumberId)
          .maybeSingle();

        if (company) {
          tenant = { companyId: company.id as string, companyName: (company.name as string) ?? null };
        } else {
          // Fallback: Busca a primeira empresa ativa para não descartar a mensagem
          const { data: fallback } = await db
            .from("companies")
            .select("id, name")
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          
          tenant = fallback
            ? { companyId: fallback.id as string, companyName: (fallback.name as string) ?? null }
            : null;
        }
        tenantCache.set(msg.phoneNumberId, tenant);
      }
      if (!tenant) {
        console.warn(
          JSON.stringify({
            scope: "whatsapp.inbound",
            level: "warn",
            msg: "tenant não resolvido — nenhuma empresa encontrada (nem fallback)",
            phoneNumberId: msg.phoneNumberId,
          }),
        );
        continue;
      }



      const resolvedTenant = tenant;
      const lockKey = `${resolvedTenant.companyId}:${msg.waContactId}`;
      await withContactLock(lockKey, () =>
        processOneMessage({ db, msg, tenant: resolvedTenant, startedAt: started }),
      );
    } catch (err) {
      console.error(
        JSON.stringify({
          scope: "whatsapp.inbound",
          level: "error",
          msg: "falha ao processar mensagem",
          error: err instanceof Error ? err.message : String(err),
          processingMs: Date.now() - started,
        }),
      );
    }
  }
}

interface ProcessArgs {
  db: { from: (t: string) => any };
  msg: ParsedTextMessage;
  tenant: { companyId: string; companyName: string | null };
  startedAt: number;
}

async function processOneMessage({ db, msg, tenant, startedAt }: ProcessArgs): Promise<void> {
  // 1) Resolve contato considerando variantes com/sem 9º dígito (BR).
  const variants = phoneVariants(msg.waContactId);
  const canonical = variants.find((v) => v.startsWith("55") && v.length === 13) ?? msg.waContactId;

  const { data: existingContacts } = await db
    .from("whatsapp_contacts")
    .select("id, wa_id")
    .eq("company_id", tenant.companyId)
    .in("wa_id", variants)
    .limit(1);

  let contactId: string;
  const existing = Array.isArray(existingContacts) ? existingContacts[0] : null;
  if (existing?.id) {
    contactId = existing.id as string;
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
    contactId = created.id as string;
  }


  // 2) Upsert conversa (preserva status e assignment já definidos pelo operador).
  // Busca status atual para decidir se devemos reabrir ou manter.
  const { data: existingConv } = await db
    .from("whatsapp_conversations")
    .select("id, status, unread_count, bella_state")
    .eq("company_id", tenant.companyId)
    .eq("contact_id", contactId)
    .maybeSingle();

  const currentStatus = (existingConv?.status as string) || "open";
  // Se estiver resolvida/arquivada, reabre. Se for nova, nasce 'open'.
  // Se estiver com 'human', mantém 'human' para não interromper o operador.
  const newStatus = (currentStatus === "resolved" || currentStatus === "archived" || currentStatus === "open" || currentStatus === "bella") 
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
      { onConflict: "company_id,contact_id" }
    )
    .select("id, bella_state, status, unread_count")
    .single();
  if (!conversation) return;
  const conversationId = conversation.id as string;
  const savedState = (conversation.bella_state ?? {}) as BellaConversationPatch;
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


  // 3) Persist inbound + dedupe (unique company_id + wa_message_id)
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

  // 3b) Incrementa não lidas para o console (não bloqueia o fluxo).
  await db
    .from("whatsapp_conversations")
    .update({ 
      unread_count: (Number(conversation.unread_count) || 0) + 1,
      updated_at: new Date().toISOString()
    })
    .eq("id", conversationId);

  // 3c) Se a conversa foi assumida por operador (ou arquivada/resolvida),
  // a Bella pausa: apenas persistimos a mensagem, sem responder.
  if (
    conversationStatus === "human" ||
    conversationStatus === "resolved" ||
    conversationStatus === "archived"
  ) {
    console.log(
      JSON.stringify({
        scope: "whatsapp.inbound",
        level: "info",
        msg: "Bella pausada — conversa sob operador/encerrada",
        conversationId,
        status: conversationStatus,
      }),
    );
    return;
  }


  // 3c-pre) Fechamento conversacional (ESTADO DO CHECKOUT - PRIORIDADE MÁXIMA).
  // Se existir um checkout ativo, ele consome a mensagem e impede que o Intent Router
  // ou qualquer Skill Geral (como Financeiro) "roube" a interação.
  
  // DEBUG LOGS
  console.log(`[CATALOG CHECKOUT DEBUG]
conversationId: ${conversationId}
activeOrderId: N/A
incomingMessage: ${msg.text}
routerSelected: router.server.ts
handlerSelected: handleCheckoutTurn (Checking...)`);

  const checkoutTurn = await handleCheckoutTurn({
    companyId: tenant.companyId,
    phone: msg.phone,
    text: msg.text,
  });

  if (checkoutTurn) {
    console.log(`[CATALOG CHECKOUT DEBUG]
checkoutState: ${checkoutTurn.step ?? 'done'}
result: INTERCEPTED BY CHECKOUT`);

    // Pedido confirmado agora (transição pra "done" pela resposta do
    // cliente): cria o ticket no inbox comercial e dispara a
    // notificação (sino + som no topo do app). Precisa acontecer aqui —
    // ver nota em handleCommercialConfirmationTurn sobre por que essa
    // etapa nunca era alcançada antes (o bloco de checkout intercepta e
    // responde primeiro, sempre).
    if (checkoutTurn.confirmed && checkoutTurn.completedSession) {
      try {
        const cartForTicket = await getCartSession(tenant.companyId, msg.phone);
        await recordConfirmedOrder({
          db,
          companyId: tenant.companyId,
          session: checkoutTurn.completedSession,
          cart: cartForTicket,
        });
        await saveCartSession(clearCartSession(cartForTicket));
      } catch (err) {
        console.error("[CATALOG CHECKOUT] Falha ao registrar pedido confirmado:", err);
      }
    }

    const checkoutSent = await sendWhatsAppText({ to: msg.phone, text: checkoutTurn.text });
    await db.from("whatsapp_messages").insert({
      company_id: tenant.companyId,
      conversation_id: conversationId,
      contact_id: contactId,
      direction: "outbound",
      wa_message_id: checkoutSent.waMessageId,
      text: checkoutTurn.text,
      status: checkoutSent.ok ? "sent" : "failed",
      error: checkoutSent.error,
      processing_ms: Date.now() - startedAt,
      provider: "catalog-nav",
      skill_id: "catalog.checkout",
    });
    if (checkoutSent.ok) {
      await db
        .from("whatsapp_conversations")
        .update({ last_outbound_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    }
    return;
  }
  
  console.log(`[CATALOG CHECKOUT DEBUG]
result: NOT INTERCEPTED (NO ACTIVE CHECKOUT)`);


  // 3c-pre-ante) Interceptação de produto específico ou Intenção de Compra.
  const purchaseIntent = isPurchaseIntent(msg.text);
  const dataSubmission = isDataSubmissionIntent(msg.text);

  if (purchaseIntent) {
    const greeting = getGreeting();
    const replyText = `${greeting}\n\nPerfeito! Vou separar para você. 📦\n\nMe informa, por favor:\n1. Seu Nome Completo\n2. Endereço com CEP para entrega\n3. Forma de pagamento (Pix, Cartão ou Dinheiro)`;
    
    const sent = await sendWhatsAppText({ to: msg.phone, text: replyText });
    await db.from("whatsapp_messages").insert({
      company_id: tenant.companyId,
      conversation_id: conversationId,
      contact_id: contactId,
      direction: "outbound",
      wa_message_id: sent.waMessageId,
      text: replyText,
      status: sent.ok ? "sent" : "failed",
      error: sent.error,
      processing_ms: Date.now() - startedAt,
      provider: "catalog-nav",
      skill_id: "catalog.purchase_pre_sale",
    });
    return;
  }

  if (dataSubmission) {
    const paymentMethod = detectPaymentMethod(msg.text);
    let replyText = "";
    
    if (paymentMethod === 'money') {
      // Primeiro pergunta do troco
      await sendWhatsAppText({ to: msg.phone, text: "Perfeito! Vai precisar de troco para quanto?" });
      // Mensagem de confirmação para dinheiro
      replyText = "Anotado! Um de nossos atendentes vai te chamar em instantes para confirmar a taxa e o horário da entrega. Muito obrigado(a)!";
    } else {
      // Mensagem padrão para PIX ou CARTÃO
      replyText = "Ótimo! Já registrei aqui. Um de nossos atendentes vai te chamar em instantes para te enviar o Pix/link de pagamento e finalizar tudo. Muito obrigado(a)!";
    }
    
    const sent = await sendWhatsAppText({ to: msg.phone, text: replyText });
    await db.from("whatsapp_messages").insert({
      company_id: tenant.companyId,
      conversation_id: conversationId,
      contact_id: contactId,
      direction: "outbound",
      wa_message_id: sent.waMessageId,
      text: replyText,
      status: sent.ok ? "sent" : "failed",
      error: sent.error,
      processing_ms: Date.now() - startedAt,
      provider: "catalog-nav",
      skill_id: "catalog.purchase_handoff",
    });

    // Altera status para 'human' (Aguardando Atendente) e pausa a Bella
    await db
      .from("whatsapp_conversations")
      .update({ 
        status: "human",
        updated_at: new Date().toISOString() 
      })
      .eq("id", conversationId);
    
    return;
  }


  const productIntent = parseCatalogProductIntent(msg.text);
  if (productIntent) {
    const { data: product } = await db
      .from("products")
      .select("id, name, price, stock, description")
      .eq("company_id", tenant.companyId)
      .or(productIntent.sku ? `sku.eq.${productIntent.sku}` : `name.ilike.%${productIntent.name}%`)
      .eq("status", "active")
      .maybeSingle();

    if (product) {
      const greeting = getGreeting();
      const isAvailable = (Number(product.stock) || 0) > 0;
      let replyText = "";

      if (isAvailable) {
        replyText = `${greeting}\n\nTemos o item ${product.name} disponível em nosso estoque sim!\n\nEle está por ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(product.price))}.\n\nAceitamos Pix, Cartão e Dinheiro. Gostaria de já garantir o seu e organizar a entrega?`;
      } else {
        replyText = `${greeting}\n\nPoxa, o item ${product.name} está esgotado no momento. 😔\n\nMas não se preocupe! Posso te mostrar algumas opções semelhantes ou te avisar assim que chegar reposição. O que acha?`;
      }

      const sent = await sendWhatsAppText({ to: msg.phone, text: replyText });
      await db.from("whatsapp_messages").insert({
        company_id: tenant.companyId,
        conversation_id: conversationId,
        contact_id: contactId,
        direction: "outbound",
        wa_message_id: sent.waMessageId,
        text: replyText,
        status: sent.ok ? "sent" : "failed",
        error: sent.error,
        processing_ms: Date.now() - startedAt,
        provider: "catalog-nav",
        skill_id: "catalog.direct_hit",
      });
      return;
    }
  }

  // 3c-pre-bis) Resumo de pedido colado a partir do catálogo do site
  // (botão "Finalizar pedido" — formato [PEDIDO-CATALOGO]). Em vez de
  // responder na mão, populamos o carrinho efêmero com os itens
  // reconhecidos e disparamos o MESMO fechamento conversacional completo
  // (nome, CPF/CNPJ, endereço via CEP, pagamento) que já existe para quem
  // fecha pedido conversando com a Bella — assim a coleta de dados fica
  // completa e consistente nos dois caminhos, terminando no mesmo
  // atendimento comercial (handleCommercialConfirmationTurn / checkoutTurn
  // logo abaixo, que já sabem lidar com uma sessão de checkout ativa).
  const websiteOrder = parseWebsiteCatalogOrder(msg.text);
  if (websiteOrder) {
    const greeting = getGreeting();
    const money = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

    let cart = await getCartSession(tenant.companyId, msg.phone);
    for (const item of websiteOrder.items) {
      const { data: matches } = await db
        .from("products")
        .select("id, name, price, brand, category_id, unit")
        .eq("company_id", tenant.companyId)
        .eq("status", "active")
        .ilike("name", `%${item.name}%`)
        .limit(1);
      const product = Array.isArray(matches) ? matches[0] : null;
      if (product) {
        cart = addProduct(
          cart,
          {
            id: product.id as string,
            name: product.name as string,
            price: Number(product.price),
            brand: (product.brand as string | null) ?? null,
            categoryId: (product.category_id as string | null) ?? null,
            unit: (product.unit as string | null) ?? null,
          },
          item.quantity,
        );
      }
    }
    await saveCartSession(cart);

    let replyText: string;
    let skillId: string;

    if (cart.items.length === 0) {
      // Nenhum item do pedido colado bateu com o catálogo atual — não dá
      // pra montar o carrinho automaticamente, encaminha direto pra humano.
      replyText = `${greeting}\n\nRecebi seu pedido, mas não consegui localizar os itens no nosso catálogo atual. Um de nossos atendentes vai te chamar em instantes para confirmar tudo. Muito obrigado(a)!`;
      skillId = "catalog.website_order_unmatched";
    } else {
      const session = createCheckoutSession(tenant.companyId, msg.phone);
      session.step = "WAITING_PAYMENT_METHOD";
      
      if (websiteOrder.deliveryMethod === "tupa") {
        session.fulfillment = "delivery";
        session.deliveryFee = 5.0;
        session.totalWithFreight = cart.total + 5.0;
      } else if (websiteOrder.deliveryMethod === "other") {
        session.fulfillment = "delivery";
        // CEP pode vir no payload
        if (websiteOrder.cep) {
          session.customer.zipCode = websiteOrder.cep;
        }
      }
      
      if (websiteOrder.name) {
        session.buyerName = websiteOrder.name;
        session.customer.fullName = websiteOrder.name;
      }

      await saveCheckoutSession(session);

      const itemsList = cart.items.map((i) => `• ${i.name} — ${i.qty} un. — ${money(i.subtotal)}`).join("\n");
      
      if (websiteOrder.deliveryMethod === "tupa") {
        replyText = `Olá! 😊\n\nRecebi seu pedido.\n\n${itemsList}\n\nTotal dos produtos: ${money(cart.total)}\nTaxa de entrega em Tupã: R$ 5,00\nTotal com entrega: ${money(cart.total + 5.0)}\n\nQual forma de pagamento você prefere?`;
      } else if (websiteOrder.deliveryMethod === "other") {
        replyText = `Olá! 😊\n\nRecebi seu pedido.\n\n${itemsList}\n\nTotal dos produtos: ${money(cart.total)}\nFrete: A calcular\n\nQual forma de pagamento você prefere?`;
      } else {
        replyText = `Olá! 😊\n\nRecebi seu pedido.\n\n${itemsList}\n\nTotal dos produtos: ${money(cart.total)}\n\nQual forma de pagamento você prefere?`;
      }
      
      skillId = "catalog.website_order_checkout_start";
    }

    const sent = await sendWhatsAppText({ to: msg.phone, text: replyText });
    await db.from("whatsapp_messages").insert({
      company_id: tenant.companyId,
      conversation_id: conversationId,
      contact_id: contactId,
      direction: "outbound",
      wa_message_id: sent.waMessageId,
      text: replyText,
      status: sent.ok ? "sent" : "failed",
      error: sent.error,
      processing_ms: Date.now() - startedAt,
      provider: "catalog-nav",
      skill_id: skillId,
    });
    const convUpdate: Record<string, unknown> = {
      status: cart.items.length === 0 ? "human" : conversationStatus,
      updated_at: new Date().toISOString(),
    };
    if (sent.ok) convUpdate.last_outbound_at = new Date().toISOString();
    await db.from("whatsapp_conversations").update(convUpdate).eq("id", conversationId);
    return;
  }

  // 3c-pre0) Confirmação do resumo → atendimento comercial (sem venda/ERP).
  const commercialTurn = await handleCommercialConfirmationTurn({
    db,
    companyId: tenant.companyId,
    phone: msg.phone,
    text: msg.text,
  });
  if (commercialTurn) {
    const sent = await sendWhatsAppText({ to: msg.phone, text: commercialTurn.text });
    await db.from("whatsapp_messages").insert({
      company_id: tenant.companyId,
      conversation_id: conversationId,
      contact_id: contactId,
      direction: "outbound",
      wa_message_id: sent.waMessageId,
      text: commercialTurn.text,
      status: sent.ok ? "sent" : "failed",
      error: sent.error,
      processing_ms: Date.now() - startedAt,
      provider: "catalog-nav",
      skill_id: "catalog.commercial_inbox",
    });
    if (sent.ok) {
      await db
        .from("whatsapp_conversations")
        .update({ last_outbound_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    }
    return;
  }

  // 3c-ante) Recomendação de produtos semelhantes (rejeição / pedido de alternativa).

  const recommendationTurn = await handleRecommendationTurn({
    db,
    storage: (
      await import("@/integrations/supabase/client.server")
    ).supabaseAdmin.storage as never,
    companyId: tenant.companyId,
    phone: msg.phone,
    text: msg.text,
    state: (savedState as Record<string, unknown>).catalog as CatalogNavState | null | undefined,
  });
  if (recommendationTurn) {
    await db
      .from("whatsapp_conversations")
      .update({
        bella_state: { ...savedState, catalog: recommendationTurn.state },
      })
      .eq("id", conversationId);

    for (const item of recommendationTurn.media) {
      const imgSent = await sendWhatsAppImage({
        to: msg.phone,
        imageUrl: item.imageUrl,
        caption: item.caption,
      });
      await db.from("whatsapp_messages").insert({
        company_id: tenant.companyId,
        conversation_id: conversationId,
        contact_id: contactId,
        direction: "outbound",
        wa_message_id: imgSent.waMessageId,
        text: item.caption,
        status: imgSent.ok ? "sent" : "failed",
        error: imgSent.error,
        processing_ms: Date.now() - startedAt,
        provider: "catalog-nav",
        skill_id: "catalog.recommendations",
      });
    }
    const recSent = await sendWhatsAppText({ to: msg.phone, text: recommendationTurn.text });
    await db.from("whatsapp_messages").insert({
      company_id: tenant.companyId,
      conversation_id: conversationId,
      contact_id: contactId,
      direction: "outbound",
      wa_message_id: recSent.waMessageId,
      text: recommendationTurn.text,
      status: recSent.ok ? "sent" : "failed",
      error: recSent.error,
      processing_ms: Date.now() - startedAt,
      provider: "catalog-nav",
      skill_id: "catalog.recommendations",
    });
    if (recSent.ok) {
      await db
        .from("whatsapp_conversations")
        .update({ last_outbound_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    }
    return;
  }

  // 3c-bis) Fotos do produto em contexto (imagens já cadastradas).
  const photoTurn = await handlePhotoTurn({
    db,
    storage: (
      await import("@/integrations/supabase/client.server")
    ).supabaseAdmin.storage as never,
    companyId: tenant.companyId,
    phone: msg.phone,
    text: msg.text,
    state: (savedState as Record<string, unknown>).catalog as CatalogNavState | null | undefined,
  });
  if (photoTurn) {
    for (const url of photoTurn.images) {
      const imgSent = await sendWhatsAppImage({ to: msg.phone, imageUrl: url });
      await db.from("whatsapp_messages").insert({
        company_id: tenant.companyId,
        conversation_id: conversationId,
        contact_id: contactId,
        direction: "outbound",
        wa_message_id: imgSent.waMessageId,
        text: "[imagem do produto]",
        status: imgSent.ok ? "sent" : "failed",
        error: imgSent.error,
        processing_ms: Date.now() - startedAt,
        provider: "catalog-nav",
        skill_id: "catalog.photos",
      });
    }
    const photoSent = await sendWhatsAppText({ to: msg.phone, text: photoTurn.text });
    await db.from("whatsapp_messages").insert({
      company_id: tenant.companyId,
      conversation_id: conversationId,
      contact_id: contactId,
      direction: "outbound",
      wa_message_id: photoSent.waMessageId,
      text: photoTurn.text,
      status: photoSent.ok ? "sent" : "failed",
      error: photoSent.error,
      processing_ms: Date.now() - startedAt,
      provider: "catalog-nav",
      skill_id: "catalog.photos",
    });
    if (photoSent.ok) {
      await db
        .from("whatsapp_conversations")
        .update({ last_outbound_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    }
    return;
  }

  // 3d) Navegação do catálogo: categorias antes dos produtos.

  const catalogTurn = await handleCatalogTurn({
    phone: msg.phone,
    db,
    companyId: tenant.companyId,
    text: msg.text,
    state: (savedState as Record<string, unknown>).catalog as CatalogNavState | null | undefined,
  });
  if (catalogTurn) {
    await db
      .from("whatsapp_conversations")
      .update({
        bella_state: catalogTurn.state
          ? { ...savedState, catalog: catalogTurn.state }
          : { ...savedState, catalog: null },
      })
      .eq("id", conversationId);

    const catalogSent = await sendWhatsAppText({ to: msg.phone, text: catalogTurn.text });
    await db.from("whatsapp_messages").insert({
      company_id: tenant.companyId,
      conversation_id: conversationId,
      contact_id: contactId,
      direction: "outbound",
      wa_message_id: catalogSent.waMessageId,
      text: catalogTurn.text,
      status: catalogSent.ok ? "sent" : "failed",
      error: catalogSent.error,
      processing_ms: Date.now() - startedAt,
      provider: "catalog-nav",
      skill_id: "catalog.browse",
    });
    if (catalogSent.ok) {
      await db
        .from("whatsapp_conversations")
        .update({ last_outbound_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    }

    // 3d-bis) Sugestões complementares após escolha/adição (somente leitura).
    const upsellTurn = await handleUpsellTurn({
      db,
      companyId: tenant.companyId,
      phone: msg.phone,
      text: msg.text,
      lastProductIds: catalogTurn.state?.lastProductIds ?? null,
    });
    if (upsellTurn) {
      const upsellSent = await sendWhatsAppText({ to: msg.phone, text: upsellTurn.text });
      await db.from("whatsapp_messages").insert({
        company_id: tenant.companyId,
        conversation_id: conversationId,
        contact_id: contactId,
        direction: "outbound",
        wa_message_id: upsellSent.waMessageId,
        text: upsellTurn.text,
        status: upsellSent.ok ? "sent" : "failed",
        error: upsellSent.error,
        processing_ms: Date.now() - startedAt,
        provider: "catalog-nav",
        skill_id: "catalog.upsell",
      });
      if (upsellSent.ok) {
        await db
          .from("whatsapp_conversations")
          .update({ last_outbound_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", conversationId);
      }
    }
    return;
  }

  // 4) Restaura o contexto Bella deste contato no singleton do engine.

  const engineKey = tenant.companyId; // Skills usam este id (empresa real)
  bellaConversationManager.clear(engineKey);
  if (savedState && Object.keys(savedState).length > 0) {
    bellaConversationManager.update(engineKey, savedState);
  }

  // 5) Roda o Action Engine (Skills + confirmação + memória curta).
  let response: BellaActionResponse;
  let providerId = "engine";
  let skillId: string | null = null;
  try {
    response = await BellaActionEngine.run(msg.text, {
      companyId: tenant.companyId,
      userId: null,
    });
    // 5b) UNKNOWN → tenta chat livre via AI Gateway (Gemini ou Mock).
    if (response.action === "UNKNOWN") {
      const ai = await bellaAIGateway.chat({
        userMessage: msg.text,
        companyName: tenant.companyName,
      });

      // Se o provider for 'mock', significa que estamos em fallback/offline
      // ou a IA está indisponível. Conforme requisito 1 e 2, não enviamos resposta automática.
      if (ai.provider === "mock") {
        console.log(
          JSON.stringify({
            scope: "whatsapp.bella",
            level: "info",
            msg: "Bella em modo offline/fallback — silenciando resposta automática",
            conversationId,
          }),
        );
        return; // Interrompe o fluxo para não enviar o outbound vazio
      }

      providerId = ai.provider;
      response = {
        action: "UNKNOWN",
        title: "",
        description: ai.response || response.description,
        metrics: [],
        priority: "low",
        suggestions: [],
      };
    } else if (response.action === "EXECUTE_SKILL") {
      skillId = "execute_skill";
    }
  } catch (err) {
    // Se ocorrer um erro grave, apenas logamos e não respondemos o cliente.
    console.error(
      JSON.stringify({
        scope: "whatsapp.bella",
        level: "error",
        msg: "engine.run falhou gravemente",
        error: err instanceof Error ? err.message : String(err),
        conversationId,
      }),
    );
    return; // Interrompe para não enviar mensagem de erro genérica ao cliente
  }

  // 6) Snapshot do contexto atualizado → persistência por contato.
  const snapshot = bellaConversationManager.get(engineKey);
  const stateToSave: Record<string, unknown> = {};
  if (snapshot) {
    if (snapshot.lastModule) stateToSave.lastModule = snapshot.lastModule;
    if (snapshot.lastAction) stateToSave.lastAction = snapshot.lastAction;
    if (snapshot.lastProvider) stateToSave.lastProvider = snapshot.lastProvider;
    if (snapshot.pendingSkill) stateToSave.pendingSkill = snapshot.pendingSkill;
  }
  bellaConversationManager.clear(engineKey);

  await db
    .from("whatsapp_conversations")
    .update({ bella_state: stateToSave, updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  // 7) Envia resposta pelo WhatsApp (texto livre — janela de 24h).
  const outText = formatBellaResponse(response);
  const sent = await sendWhatsAppText({ to: msg.phone, text: outText });

  // 8) Persist outbound + evento agregado.
  await db.from("whatsapp_messages").insert({
    company_id: tenant.companyId,
    conversation_id: conversationId,
    contact_id: contactId,
    direction: "outbound",
    wa_message_id: sent.waMessageId,
    text: outText,
    status: sent.ok ? "sent" : "failed",
    error: sent.error,
    processing_ms: Date.now() - startedAt,
    provider: providerId,
    skill_id: skillId,
  });
  if (sent.ok) {
    await db
      .from("whatsapp_conversations")
      .update({ last_outbound_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", conversationId);
  }

  console.log(
    JSON.stringify({
      scope: "whatsapp.inbound",
      level: "info",
      msg: "mensagem respondida",
      companyId: tenant.companyId,
      waMessageId: msg.waMessageId,
      provider: providerId,
      action: response.action,
      processingMs: Date.now() - startedAt,
      sent: sent.ok,
    }),
  );
}
