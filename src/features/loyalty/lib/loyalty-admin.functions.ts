import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Programa de Fidelidade — administração interna (uso autenticado).
 */

export const getLoyaltySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ companyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: settings } = await supabase
      .from("loyalty_settings")
      .select("*")
      .eq("company_id", data.companyId)
      .maybeSingle();

    return (
      settings ?? {
        company_id: data.companyId,
        enabled: false,
        points_per_real: 1,
        redemption_value_per_point: 0.05,
      }
    );
  });

export const saveLoyaltySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      companyId: z.string().uuid(),
      enabled: z.boolean(),
      pointsPerReal: z.number().min(0),
      redemptionValuePerPoint: z.number().min(0),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("loyalty_settings").upsert({
      company_id: data.companyId,
      enabled: data.enabled,
      points_per_real: data.pointsPerReal,
      redemption_value_per_point: data.redemptionValuePerPoint,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[saveLoyaltySettings] Erro:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  });

export const listLoyaltyAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ companyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: accounts, error } = await supabase
      .from("loyalty_accounts")
      .select("customer_id, points_balance, updated_at, customers(name, phone)")
      .eq("company_id", data.companyId)
      .order("points_balance", { ascending: false })
      .limit(200);

    if (error) {
      console.error("[listLoyaltyAccounts] Erro:", error);
      return [];
    }
    return accounts;
  });

export const adjustLoyaltyPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      companyId: z.string().uuid(),
      customerId: z.string().uuid(),
      points: z.number().int(),
      notes: z.string().optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: account } = await supabase
      .from("loyalty_accounts")
      .select("points_balance")
      .eq("customer_id", data.customerId)
      .maybeSingle();

    const currentBalance = account?.points_balance ?? 0;
    const newBalance = currentBalance + data.points;

    const { error: upsertError } = await supabase.from("loyalty_accounts").upsert({
      customer_id: data.customerId,
      company_id: data.companyId,
      points_balance: newBalance,
      updated_at: new Date().toISOString(),
    });

    if (upsertError) {
      console.error("[adjustLoyaltyPoints] Erro:", upsertError);
      return { success: false, error: upsertError.message };
    }

    await supabase.from("loyalty_transactions").insert({
      company_id: data.companyId,
      customer_id: data.customerId,
      points: data.points,
      type: data.points >= 0 ? "adjustment" : "redeemed",
      notes: data.notes || "Ajuste manual",
    });

    return { success: true, newBalance };
  });
