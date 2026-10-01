import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PostgrestError } from "@supabase/supabase-js";
import { persistNotification } from "./persistence.server";
import {
  BIWEEKLY_SUMMARY_DAYS,
  BIWEEKLY_SUMMARY_EVENT,
  BIWEEKLY_SUMMARY_TOP,
  buildBiweeklySummary,
  type TopSellingProduct,
} from "./biweekly-summary";

// A migration added this RPC after the checked-in Supabase types were generated.
// Keep the local signature aligned with its RETURNS TABLE until types are regenerated.
type TopSellingRpc = {
  rpc: (
    name: "top_selling_products",
    args: { _company_id: string; _days: number; _limit: number },
  ) => PromiseLike<{ data: TopSellingProduct[] | null; error: PostgrestError | null }>;
};

/**
 * Gera o resumo quinzenal da empresa se o último tiver mais de 15 dias.
 * Chamado pelo job bella-detectors (a cada 30 min): a checagem de data
 * garante no máximo um resumo a cada 15 dias por empresa.
 *
 * @returns true se uma notificação foi criada.
 */
export async function maybeSendBiweeklySummary(
  companyId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const since = new Date(now.getTime() - BIWEEKLY_SUMMARY_DAYS * 86_400_000).toISOString();

  const { count, error: countError } = await supabaseAdmin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("event_type", BIWEEKLY_SUMMARY_EVENT)
    .gte("created_at", since);
  if (countError) throw countError;
  if ((count ?? 0) > 0) return false;

  const [topResult, restockResult] = await Promise.all([
    (supabaseAdmin as unknown as TopSellingRpc).rpc("top_selling_products", {
      _company_id: companyId,
      _days: BIWEEKLY_SUMMARY_DAYS,
      _limit: BIWEEKLY_SUMMARY_TOP,
    }),
    supabaseAdmin.rpc("compute_restock_suggestions", { _company_id: companyId }),
  ]);
  if (topResult.error) throw topResult.error;
  if (restockResult.error) throw restockResult.error;

  const top = (topResult.data ?? []).map((row) => ({
    product_id: row.product_id,
    name: row.name,
    quantity: Number(row.quantity),
    revenue: Number(row.revenue),
  })) as TopSellingProduct[];
  const restockItems = (restockResult.data as { items?: unknown[] } | null)?.items ?? [];

  const summary = buildBiweeklySummary(top, restockItems.length);
  if (!summary) return false; // nada vendido e nada a repor: não incomoda

  await persistNotification({
    companyId,
    eventType: BIWEEKLY_SUMMARY_EVENT,
    title: summary.title,
    message: summary.message,
    referenceId: null,
    metadata: {
      periodDays: BIWEEKLY_SUMMARY_DAYS,
      top,
      restockCount: restockItems.length,
    },
  });
  return true;
}
