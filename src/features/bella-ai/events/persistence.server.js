import { supabaseAdmin } from "@/integrations/supabase/client.server";
export async function persistNotification(data) {
    // Prevenção de duplicidade: não gravar se já existe um evento 'unread' 
    // do mesmo tipo para a mesma entidade/tenant nas últimas 24h.
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const refId = data.referenceId || null;
    let existingQuery = supabaseAdmin
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
    const { data: inserted, error } = await supabaseAdmin
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
export async function fetchUnreadNotifications(companyId, limit) {
    const { data, error } = await supabaseAdmin
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
export async function markNotificationAsRead(notificationId, companyId) {
    const { error } = await supabaseAdmin
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
export async function markNotificationAsReadByContent(companyId, eventType, referenceId) {
    console.log("[Persistence] markNotificationAsReadByContent chamado com:", {
        companyId,
        eventType,
        referenceId,
    });
    let query = supabaseAdmin
        .from("notifications")
        .update({
        status: "read",
        read_at: new Date().toISOString(),
    })
        .eq("company_id", companyId)
        .eq("event_type", eventType)
        .eq("status", "unread");
    query = referenceId === null ? query.is("reference_id", null) : query.eq("reference_id", referenceId);
    // .select() faz o update devolver as linhas afetadas — sem isso, não
    // dá pra saber se 0 ou N linhas foram atualizadas (Supabase não avisa
    // sozinho quando um update não bate com nada, não é um "erro").
    const { data: updatedRows, error } = await query.select("id, event_type, reference_id, status");
    if (error) {
        console.error("[Persistence] Erro ao ler notificação (por conteúdo):", error);
        throw error;
    }
    console.log(`[Persistence] markNotificationAsReadByContent: ${updatedRows?.length ?? 0} linha(s) atualizada(s).`, updatedRows);
    if (!updatedRows || updatedRows.length === 0) {
        // Diagnóstico extra: busca (sem filtrar por status) pra ver se a
        // linha existe com outro valor de reference_id/status do que o
        // esperado — isso aparece nos logs do servidor e ajuda a apontar a
        // causa exata na próxima investigação, caso ainda não tenha resolvido.
        const { data: debugRows } = await supabaseAdmin
            .from("notifications")
            .select("id, event_type, reference_id, status, created_at")
            .eq("company_id", companyId)
            .eq("event_type", eventType)
            .order("created_at", { ascending: false })
            .limit(5);
        console.warn("[Persistence] Nenhuma linha batida. Últimas 5 notificações desse tipo/empresa pra comparar:", debugRows);
    }
    return { success: true, updatedCount: updatedRows?.length ?? 0 };
}
