import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCompanyId } from "@/lib/company-resolver.server";
import { z } from "zod";
import { DEFAULT_ML_SETTINGS } from "../utils/ml-pricing";
const settingsSchema = z.object({
    freeShippingThreshold: z.number().min(0),
    freeShippingValue: z.number().min(0),
    fixedFeeValue: z.number().min(0),
    classicFeePercent: z.number().min(0).max(1),
    premiumFeePercent: z.number().min(0).max(1),
});
export const getMercadoLivreSettings = createServerFn({ method: "GET" })
    .middleware([requireSupabaseAuth])
    .handler(async ({ context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data, error } = await supabase
        .from("mercadolivre_settings")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();
    if (error)
        throw error;
    if (!data) {
        return DEFAULT_ML_SETTINGS;
    }
    return {
        freeShippingThreshold: Number(data.free_shipping_threshold),
        freeShippingValue: Number(data.free_shipping_value),
        fixedFeeValue: Number(data.fixed_fee_value),
        classicFeePercent: Number(data.classic_fee_percent),
        premiumFeePercent: Number(data.premium_fee_percent),
    };
});
export const updateMercadoLivreSettings = createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((data) => settingsSchema.parse(data))
    .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { error } = await supabase
        .from("mercadolivre_settings")
        .upsert({
        company_id: companyId,
        free_shipping_threshold: data.freeShippingThreshold,
        free_shipping_value: data.freeShippingValue,
        fixed_fee_value: data.fixedFeeValue,
        classic_fee_percent: data.classicFeePercent,
        premium_fee_percent: data.premiumFeePercent,
        updated_at: new Date().toISOString(),
    }, { onConflict: "company_id" });
    if (error)
        throw error;
    return { success: true };
});
