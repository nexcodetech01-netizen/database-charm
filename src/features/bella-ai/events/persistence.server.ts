import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function persistNotification(data: {
  companyId: string;
  eventType: string;
  title: string;
  message: string;
  referenceId?: string | null;
  metadata?: any;
}) {
  const { data: inserted, error } = await (supabaseAdmin as any)
    .from("notifications")
    .insert({
      company_id: data.companyId,
      event_type: data.eventType,
      title: data.title,
      message: data.message,
      reference_id: data.referenceId,
      metadata: data.metadata || {},
      status: "unread",
    })
    .select()
    .single();

  if (error) {
    console.error("[Persistence] Erro ao salvar notificação:", error);
    throw error;
  }
  return inserted;
}

export async function fetchUnreadNotifications(companyId: string, limit: number) {
  const { data, error } = await (supabaseAdmin as any)
    .from("notifications")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "unread")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[Persistence] Erro ao buscar notificações:", error);
    throw error;
  }
  return data || [];
}

export async function markNotificationAsRead(notificationId: string, companyId: string) {
  const { error } = await (supabaseAdmin as any)
    .from("notifications")
    .update({ 
      status: "read",
      read_at: new Date().toISOString()
    })
    .eq("id", notificationId)
    .eq("company_id", companyId);

  if (error) {
    console.error("[Persistence] Erro ao ler notificação:", error);
    throw error;
  }
  return { success: true };
}
