/**
 * WhatsApp Cloud API — usage monitoring server functions.
 *
 * Counts outbound messages sent in the current calendar month for a company.
 * Purely informational — does NOT block sending.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface WhatsAppMonthlyUsageResult {
  companyId: string;
  month: string; // YYYY-MM
  monthStart: string; // ISO
  count: number;
  threshold: number;
  warning: boolean;
}

export const getWhatsAppMonthlyUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyId: string }) => data)
  .handler(async ({ data, context }): Promise<WhatsAppMonthlyUsageResult> => {
    const threshold = 500;
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthStartIso = monthStart.toISOString();
    const month = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`;

    const { count, error } = await context.supabase
      .from("whatsapp_message_events")
      .select("id", { count: "exact", head: true })
      .eq("company_id", data.companyId)
      .eq("direction", "outbound")
      .gte("sent_at", monthStartIso);

    if (error) throw new Error(error.message);

    const total = count ?? 0;
    return {
      companyId: data.companyId,
      month,
      monthStart: monthStartIso,
      count: total,
      threshold,
      warning: total >= threshold,
    };
  });
