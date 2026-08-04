/**
 * Console WhatsApp — server functions.
 * Todas as chamadas passam pelo `requireSupabaseAuth`, então a RLS
 * de `user_has_company_access` continua sendo a fonte da verdade.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireServerPermission } from "@/features/rbac/guards/server-guards";
import { z } from "zod";
import type {
  ConversationDetail,
  ConversationListItem,
  ConversationMessage,
  ConversationMetrics,
  ConversationNote,
  ConversationStatus,
} from "./types";

const uuid = z.string().uuid();

/* -------------------- CREATE CONVERSATION -------------------- */

function normalizePhone(input: string): string {
  return input.replace(/\D+/g, "");
}

export const createConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        companyId: uuid,
        phone: z.string().min(6).max(32),
        name: z.string().trim().max(120).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ conversationId: string; contactId: string; templateSent: boolean; templateError: string | null }> => {
    const db = context.supabase as unknown as { from: (t: string) => any };
    const waId = normalizePhone(data.phone);
    if (waId.length < 8) throw new Error("Número de telefone inválido.");
    const displayName = data.name?.trim() || null;

    const { data: contact, error: contactError } = await db
      .from("whatsapp_contacts")
      .upsert(
        {
          company_id: data.companyId,
          wa_id: waId,
          phone: waId,
          profile_name: displayName,
        },
        { onConflict: "company_id,wa_id" },
      )
      .select("id")
      .single();
    if (contactError || !contact) {
      throw new Error(contactError?.message ?? "Não foi possível criar o contato.");
    }

    const { data: conv, error: convError } = await db
      .from("whatsapp_conversations")
      .upsert(
        {
          company_id: data.companyId,
          contact_id: contact.id,
          status: "human",
          assigned_operator_id: context.userId,
        },
        { onConflict: "company_id,contact_id" },
      )
      .select("id")
      .single();
    if (convError || !conv) {
      throw new Error(convError?.message ?? "Não foi possível criar a conversa.");
    }

    // Dispara template 'hello_world' (aprovado por padrão pela Meta) para abrir a janela de 24h.
    let templateSent = false;
    let templateError: string | null = null;
    try {
      const { sendWhatsAppTemplateRaw } = await import("@/lib/whatsapp.server");
      const sent = await sendWhatsAppTemplateRaw({
        to: waId,
        templateName: "hello_world",
        languageCode: "en_US",
      });
      templateSent = sent.ok;
      templateError = sent.error;
      const nowIso = new Date().toISOString();
      await db.from("whatsapp_messages").insert({
        company_id: data.companyId,
        conversation_id: conv.id,
        contact_id: contact.id,
        direction: "outbound",
        wa_message_id: sent.waMessageId,
        text: "Hello World",
        status: sent.ok ? "sent" : "failed",
        error: sent.error,
        provider: "operator",
        skill_id: null,
      });
      if (sent.ok) {
        await db
          .from("whatsapp_conversations")
          .update({ last_outbound_at: nowIso })
          .eq("id", conv.id);
      }
    } catch (err) {
      templateError = err instanceof Error ? err.message : "Falha ao enviar template.";
    }

    return {
      conversationId: conv.id as string,
      contactId: contact.id as string,
      templateSent,
      templateError,
    };
  });

/* -------------------- LIST -------------------- */

export const listConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ companyId: uuid, limit: z.number().int().min(1).max(200).optional() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ConversationListItem[]> => {
    const db = context.supabase as unknown as { from: (t: string) => any };
    const { data: rows, error } = await db
      .from("whatsapp_conversations")
      .select(
        `id, company_id, contact_id, status, assigned_operator_id, unread_count,
         protocol, last_inbound_at, last_outbound_at, updated_at, ultima_mensagem_cliente_at,
         contact:whatsapp_contacts!inner ( id, wa_id, phone, profile_name, ultima_mensagem_cliente_at ),
         operator:profiles!whatsapp_conversations_assigned_operator_id_fkey ( id, full_name )`,
      )
      .eq("company_id", data.companyId)
      .order("updated_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (error) throw new Error(error.message);

    const list = (rows ?? []) as any[];
    if (list.length === 0) return [];

    // Última mensagem por conversa em lote (para preview + timestamp).
    const ids = list.map((r) => r.id as string);
    const { data: lastMsgs } = await db
      .from("whatsapp_messages")
      .select("conversation_id, text, created_at, direction, provider")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false });
    const lastByConv = new Map<string, any>();
    for (const m of (lastMsgs ?? []) as any[]) {
      if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m);
    }

    return list.map((r) => {
      const last = lastByConv.get(r.id);
      const lastAt =
        last?.created_at ?? r.last_inbound_at ?? r.last_outbound_at ?? r.updated_at ?? null;
      return {
        id: r.id,
        company_id: r.company_id,
        contact_id: r.contact_id,
        contact_name: r.contact?.profile_name ?? null,
        contact_phone: r.contact?.phone ?? null,
        contact_wa_id: r.contact?.wa_id ?? "",
        status: (r.status ?? "open") as ConversationStatus,
        assigned_operator_id: r.assigned_operator_id ?? null,
        assigned_operator_name: r.operator?.full_name ?? null,
        unread_count: Number(r.unread_count ?? 0),
        protocol: r.protocol ?? null,
        last_inbound_at: r.last_inbound_at ?? null,
        last_outbound_at: r.last_outbound_at ?? null,
        last_message_text: last?.text ?? null,
        last_message_at: lastAt,
        last_message_direction: (last?.direction ?? null) as "inbound" | "outbound" | null,
        last_message_provider: last?.provider ?? null,
        ultima_mensagem_cliente_at: r.ultima_mensagem_cliente_at ?? r.contact?.ultima_mensagem_cliente_at ?? null,
        channel: "whatsapp",
      } satisfies ConversationListItem;
    }).sort((a, b) => {
      const av = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bv = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bv - av;
    });
  });

/* -------------------- DETAIL -------------------- */

export const getConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ conversationId: uuid, limit: z.number().int().min(1).max(500).optional() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ConversationDetail | null> => {
    const db = context.supabase as unknown as { from: (t: string) => any };
    const { data: row, error } = await db
      .from("whatsapp_conversations")
      .select(
        `id, company_id, contact_id, status, assigned_operator_id, unread_count,
         protocol, last_inbound_at, last_outbound_at, updated_at, bella_state, notes,
         contact:whatsapp_contacts!inner ( id, wa_id, phone, profile_name ),
         operator:profiles!whatsapp_conversations_assigned_operator_id_fkey ( id, full_name )`,
      )
      .eq("id", data.conversationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;

    const { data: msgs } = await db
      .from("whatsapp_messages")
      .select(
        "id, conversation_id, direction, text, status, error, provider, skill_id, processing_ms, wa_message_id, created_at",
      )
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true })
      .limit(data.limit ?? 300);

    return {
      id: row.id,
      company_id: row.company_id,
      contact_id: row.contact_id,
      contact_name: row.contact?.profile_name ?? null,
      contact_phone: row.contact?.phone ?? null,
      contact_wa_id: row.contact?.wa_id ?? "",
      status: (row.status ?? "open") as ConversationStatus,
      assigned_operator_id: row.assigned_operator_id ?? null,
      assigned_operator_name: row.operator?.full_name ?? null,
      unread_count: Number(row.unread_count ?? 0),
      protocol: row.protocol ?? null,
      last_inbound_at: row.last_inbound_at ?? null,
      last_outbound_at: row.last_outbound_at ?? null,
      last_message_text: null,
      last_message_at: null,
      last_message_direction: null,
      last_message_provider: null,
      channel: "whatsapp",
      
      notes: Array.isArray(row.notes) ? (row.notes as ConversationNote[]) : [],
      messages: ((msgs ?? []) as any[]).map((m) => ({
        id: m.id,
        conversation_id: m.conversation_id,
        direction: m.direction,
        text: m.text,
        status: m.status,
        error: m.error,
        provider: m.provider,
        skill_id: m.skill_id,
        processing_ms: m.processing_ms,
        wa_message_id: m.wa_message_id,
        created_at: m.created_at,
      })) satisfies ConversationMessage[],
    };
  });

/* -------------------- METRICS -------------------- */

export const getConsoleMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ companyId: uuid }).parse(input))
  .handler(async ({ data, context }): Promise<ConversationMetrics> => {
    const db = context.supabase as unknown as { from: (t: string) => any };
    const { data: convs } = await db
      .from("whatsapp_conversations")
      .select("id, status")
      .eq("company_id", data.companyId);

    const rows = (convs ?? []) as { id: string; status: string | null }[];
    const total = rows.length;
    const open = rows.filter((r) => (r.status ?? "open") === "open").length;
    const bella = rows.filter((r) => r.status === "bella").length;
    const human = rows.filter((r) => r.status === "human").length;
    const resolved = rows.filter((r) => r.status === "resolved").length;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { count: msgsToday } = await db
      .from("whatsapp_messages")
      .select("id", { count: "exact", head: true })
      .eq("company_id", data.companyId)
      .gte("created_at", startOfDay.toISOString());

    // Tempo médio: usa processing_ms das últimas 100 respostas outbound.
    const { data: recent } = await db
      .from("whatsapp_messages")
      .select("processing_ms")
      .eq("company_id", data.companyId)
      .eq("direction", "outbound")
      .not("processing_ms", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);
    const ms = ((recent ?? []) as { processing_ms: number | null }[])
      .map((r) => Number(r.processing_ms ?? 0))
      .filter((n) => n > 0);
    const avg = ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : null;

    return {
      open,
      bella,
      human,
      resolved,
      messagesToday: Number(msgsToday ?? 0),
      avgResponseSeconds: avg ? Math.round(avg / 100) / 10 : null,
      resolutionRate: total ? Math.round((resolved / total) * 100) : 0,
    };
  });

/* -------------------- ACTIONS -------------------- */

export const assumeConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ conversationId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as { from: (t: string) => any };
    const { error } = await db
      .from("whatsapp_conversations")
      .update({ status: "human", assigned_operator_id: context.userId })
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const returnToBella = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ conversationId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as { from: (t: string) => any };
    const { error } = await db
      .from("whatsapp_conversations")
      .update({ status: "bella", assigned_operator_id: null })
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setConversationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        conversationId: uuid,
        status: z.enum(["open", "bella", "human", "waiting_customer", "resolved", "archived"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as { from: (t: string) => any };
    const { error } = await db
      .from("whatsapp_conversations")
      .update({ status: data.status })
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ conversationId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as { from: (t: string) => any };
    await db.from("whatsapp_conversations").update({ unread_count: 0 }).eq("id", data.conversationId);
    return { ok: true };
  });

export const addConversationNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ conversationId: uuid, text: z.string().min(1).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as { from: (t: string) => any };
    const { data: current } = await db
      .from("whatsapp_conversations")
      .select("notes")
      .eq("id", data.conversationId)
      .single();
    const existing: ConversationNote[] = Array.isArray(current?.notes)
      ? (current!.notes as ConversationNote[])
      : [];

    const { data: profile } = await db
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();

    const note: ConversationNote = {
      id: crypto.randomUUID(),
      author_id: context.userId,
      author_name: (profile?.full_name as string) ?? null,
      text: data.text,
      created_at: new Date().toISOString(),
    };
    const { error } = await db
      .from("whatsapp_conversations")
      .update({ notes: [...existing, note] })
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    return { note };
  });

/* -------------------- SEND (operator) -------------------- */

export const sendOperatorMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      conversationId: uuid,
      text: z.string().min(1).max(4096),
      type: z.enum(["text", "template"]).optional().default("text"),
      templateName: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Hardening RBAC server-side (a UI não é barreira de segurança).
    await requireServerPermission(context, "bella_ia.update", {
      action: "whatsapp.operator.send",
      module: "whatsapp",
    });
    const db = context.supabase as unknown as { from: (t: string) => any };
    // RLS garante escopo por empresa.
    const { data: conv, error } = await db
      .from("whatsapp_conversations")
      .select(
        "id, company_id, contact_id, status, ultima_mensagem_cliente_at, contact:whatsapp_contacts!inner ( phone, wa_id, ultima_mensagem_cliente_at )",
      )
      .eq("id", data.conversationId)
      .single();
    if (error || !conv) throw new Error(error?.message ?? "Conversa não encontrada.");

    const to = (conv.contact?.phone as string) || (conv.contact?.wa_id as string);
    const { sendWhatsAppText, sendWhatsAppTemplateRaw, WHATSAPP_NOT_CONFIGURED } = await import(
      "@/lib/whatsapp.server"
    );

    // Lógica Inteligente de Envio (Requisito 3)
    const lastInboundAt = conv.ultima_mensagem_cliente_at || conv.contact?.ultima_mensagem_cliente_at;
    const isWindowOpen = lastInboundAt 
      ? (Date.now() - new Date(lastInboundAt).getTime()) <= 24 * 60 * 60 * 1000 
      : false;

    let sent;
    if (data.type === "template" && data.templateName) {
      sent = await sendWhatsAppTemplateRaw({ to, templateName: data.templateName });
    } else if (isWindowOpen) {
      sent = await sendWhatsAppText({ to, text: data.text });
    } else {
      // Janela FECHADA e não foi solicitado template: fallback para template padrão (boas_vindas)
      sent = await sendWhatsAppTemplateRaw({ to, templateName: "boas_vindas" });
    }

    // Integração ainda não configurada: não é falha de envio. Devolvemos um
    // aviso amigável, sem lançar erro e sem poluir a timeline com uma
    // mensagem "falhada" que nunca chegou a ser tentada na Meta.
    if (!sent.ok && sent.code === WHATSAPP_NOT_CONFIGURED) {
      return {
        ok: false as const,
        waMessageId: null,
        code: WHATSAPP_NOT_CONFIGURED,
        message: sent.error,
        missing: sent.missing ?? [],
      };
    }

    await db.from("whatsapp_messages").insert({
      company_id: conv.company_id,
      conversation_id: conv.id,
      contact_id: conv.contact_id,
      direction: "outbound",
      wa_message_id: sent.waMessageId,
      text: data.text,
      status: sent.ok ? "sent" : "failed",
      error: sent.error,
      provider: "operator",
      skill_id: null,
    });

    const patch: Record<string, unknown> = {
      last_outbound_at: new Date().toISOString(),
    };
    if (conv.status !== "human") patch.status = "human";
    if (!conv.assigned_operator_id) patch.assigned_operator_id = context.userId;
    await db.from("whatsapp_conversations").update(patch).eq("id", conv.id);

    if (!sent.ok) throw new Error(sent.error ?? "Falha ao enviar pelo WhatsApp.");
    return {
      ok: true as const,
      waMessageId: sent.waMessageId,
      code: null,
      message: null,
      missing: [] as string[],
    };
  });

/* -------------------- DELETE CONVERSATION -------------------- */

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ conversationId: uuid }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Hardening RBAC server-side (a UI não é barreira de segurança).
    await requireServerPermission(context, "bella_ia.delete", {
      action: "whatsapp.conversation.delete",
      module: "whatsapp",
    });
    const db = context.supabase as unknown as { from: (t: string) => any };
    // RLS garante escopo por empresa. Apagamos mensagens primeiro pois não há
    // ON DELETE CASCADE configurado no FK.
    const { error: msgErr } = await db
      .from("whatsapp_messages")
      .delete()
      .eq("conversation_id", data.conversationId);
    if (msgErr) throw new Error(msgErr.message);
    const { error } = await db
      .from("whatsapp_conversations")
      .delete()
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
