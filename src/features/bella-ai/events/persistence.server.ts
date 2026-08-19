import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function persistNotification(data: {
  companyId: string;
  eventType: string;
  title: string;
  message: string;
  referenceId?: string | null;
  metadata?: any;
}) {
  // Prevenção de duplicidade: não gravar se já existe um evento 'unread' 
  // do mesmo tipo para a mesma entidade/tenant nas últimas 24h.
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const refId = data.referenceId || null;

  let existingQuery = (supabaseAdmin as any)
    .from("notifications")
    .select("id")
    .eq("company_id", data.companyId)
    .eq("event_type", data.eventType)
    .eq("status", "unread")
    .gt("created_at", oneDayAgo);

  // CORREÇÃO: `.eq("reference_id", null)` nunca bate com nada no
  // Supabase/PostgREST, mesmo contra linhas onde a coluna também é NULL
  // (vira `= NULL` em SQL, sempre indeterminado). Isso fazia a checagem
  // de duplicidade nunca encontrar duplicata pra eventos sem
  // referenceId, e o mesmo bug afetava `markNotificationAsReadByContent`
  // logo abaixo — corrigido nos dois com `.is()` quando o valor é null.
  existingQuery = refId === null ? existingQuery.is("reference_id", null) : existingQuery.eq("reference_id", refId);

  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    return existing; // Ignora duplicidade
  }

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

/**
 * Marca como lida por CONTEÚDO do evento (empresa + tipo + referência),
 * não pelo id do banco.
 *
 * BUG QUE ISSO CORRIGE: eventos criados ao vivo (via `BellaEventEngine.emit`)
 * recebem um id sintético local (`bella-evt-<timestamp>-<seq>`, gerado em
 * `nextId()`) — não um UUID. A linha real na tabela `notifications` só é
 * criada depois, de forma assíncrona e "fire-and-forget" em
 * `BellaEventRegistry.record()` (`saveNotification(...).catch(...)`, sem
 * aguardar nem devolver o id real de volta pro evento em memória). Ou
 * seja: pra eventos que chegam AO VIVO durante a sessão, o id que a tela
 * conhece NUNCA bate com o id real salvo no banco — "marcar como lida"
 * atualizava 0 linhas (ou nem completava, já que `readNotification`
 * valida o id como UUID e um id sintético falha nessa validação).
 * Resultado: a notificação sumia da tela (efeito só local, em memória),
 * mas continuava "não lida" no banco pra sempre — e reaparecia a cada
 * refresh, já que a hidratação busca as não lidas direto do banco.
 *
 * A correção usa a MESMA combinação (empresa + tipo + referência) que
 * `persistNotification` já usa pra deduplicar — não depende de nenhum id
 * sintético bater com o real, e funciona igual tanto pra eventos
 * hidratados do banco quanto pra eventos que chegaram ao vivo.
 */
export async function markNotificationAsReadByContent(
  companyId: string,
  eventType: string,
  referenceId: string | null,
) {
  // CORREÇÃO 2: quando `referenceId` é null (evento sem entityId/ticketId
  // no payload — bem comum), `.eq("reference_id", null)` NUNCA bate com
  // nada no Supabase/PostgREST — mesmo contra linhas onde a coluna
  // também é NULL. `.eq()` vira `= NULL` em SQL, que é sempre
  // indeterminado (nunca verdadeiro), diferente de `IS NULL`. É preciso
  // usar `.is()` especificamente para comparar com null. Sem isso, toda
  // notificação sem referenceId continuava "não lida" no banco pra
  // sempre, mesmo depois da primeira correção (empresa+tipo+referência).
  let query = (supabaseAdmin as any)
    .from("notifications")
    .update({
      status: "read",
      read_at: new Date().toISOString(),
    })
    .eq("company_id", companyId)
    .eq("event_type", eventType)
    .eq("status", "unread");

  query = referenceId === null ? query.is("reference_id", null) : query.eq("reference_id", referenceId);

  const { error } = await query;

  if (error) {
    console.error("[Persistence] Erro ao ler notificação (por conteúdo):", error);
    throw error;
  }
  return { success: true };
}
