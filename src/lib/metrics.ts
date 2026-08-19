import { supabase } from "@/integrations/supabase/client";

/**
 * Registra uma métrica de query (tamanho do payload) de forma best-effort.
 * Não bloqueia o fluxo principal da aplicação.
 */
export function logQueryMetric(queryName: string, data: any, companyId: string | null) {
  if (!companyId || !data) return;

  // Cálculo aproximado do tamanho em KB
  try {
    const sizeInBytes = new TextEncoder().encode(JSON.stringify(data)).length;
    const sizeInKb = parseFloat((sizeInBytes / 1024).toFixed(2));

    // Gravação assíncrona (best-effort)
    supabase
      .from("query_metrics")
      .insert({
        query_name: queryName,
        payload_size_kb: sizeInKb,
        company_id: companyId,
      })
      .then(({ error }) => {
        if (error) {
          console.warn(`[METRICS] Falha ao registrar métrica ${queryName}:`, error.message);
        }
      });
  } catch (err) {
    console.warn(`[METRICS] Erro ao calcular tamanho do payload para ${queryName}:`, err);
  }
}
