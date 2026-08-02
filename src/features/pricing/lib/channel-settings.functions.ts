/**
 * Server functions — Product Channel Pricing Settings
 * ====================================================
 * Persistência das preferências por canal (margem alvo %, tarifa fixa R$
 * e modo de cálculo) editadas em `suggested-prices-by-channel-card.tsx`.
 *
 * Storage: coluna `products.channel_pricing_settings` (JSONB).
 * Estrutura:
 *   {
 *     globalStrategy?: "policy" | "keep_store_profit",
 *     channels: {
 *       [channelId]: {
 *         marginPct?: number,   // override da margem alvo
 *         fixedCost?: number,   // tarifa fixa em R$
 *         strategy?: "policy" | "keep_store_profit"
 *       }
 *     }
 *   }
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireServerPermission } from "@/features/rbac/guards/server-guards";

export type ChannelStrategy = "policy" | "keep_store_profit";

export interface ChannelSettingEntry {
  marginPct?: number;
  fixedCost?: number;
  strategy?: ChannelStrategy;
}

export interface ProductChannelSettingsDTO {
  globalStrategy?: ChannelStrategy;
  channels: Record<string, ChannelSettingEntry>;
}

const EMPTY: ProductChannelSettingsDTO = { channels: {} };

const isStrategy = (v: unknown): v is ChannelStrategy =>
  v === "policy" || v === "keep_store_profit";

function sanitize(input: unknown): ProductChannelSettingsDTO {
  if (!input || typeof input !== "object") return EMPTY;
  const obj = input as Record<string, unknown>;
  const out: ProductChannelSettingsDTO = { channels: {} };

  if (isStrategy(obj.globalStrategy)) out.globalStrategy = obj.globalStrategy;

  const channels = obj.channels;
  if (channels && typeof channels === "object") {
    for (const [key, raw] of Object.entries(channels as Record<string, unknown>)) {
      if (!key || typeof key !== "string" || key.length > 40) continue;
      if (!raw || typeof raw !== "object") continue;
      const entry = raw as Record<string, unknown>;
      const clean: ChannelSettingEntry = {};

      const m = Number(entry.marginPct);
      if (Number.isFinite(m) && m >= 0 && m < 100) clean.marginPct = m;

      const f = Number(entry.fixedCost);
      if (Number.isFinite(f) && f >= 0 && f < 1_000_000) clean.fixedCost = f;

      if (isStrategy(entry.strategy)) clean.strategy = entry.strategy;

      if (Object.keys(clean).length > 0) out.channels[key] = clean;
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// getProductChannelSettings
// ─────────────────────────────────────────────────────────────────────────────

export const getProductChannelSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string; productId: string }) => {
    if (!input?.companyId) throw new Error("companyId é obrigatório");
    if (!input?.productId) throw new Error("productId é obrigatório");
    return input;
  })
  .handler(async ({ data, context }): Promise<ProductChannelSettingsDTO> => {
    const res = await context.supabase
      .from("products")
      .select("channel_pricing_settings")
      .eq("company_id", data.companyId)
      .eq("id", data.productId)
      .maybeSingle();
    if (res.error) throw res.error;
    return sanitize(
      (res.data as { channel_pricing_settings?: unknown } | null)?.channel_pricing_settings,
    );
  });

// ─────────────────────────────────────────────────────────────────────────────
// saveProductChannelSettings
// ─────────────────────────────────────────────────────────────────────────────

export const saveProductChannelSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { companyId: string; productId: string; settings: ProductChannelSettingsDTO }) => {
      if (!input?.companyId) throw new Error("companyId é obrigatório");
      if (!input?.productId) throw new Error("productId é obrigatório");
      return { ...input, settings: sanitize(input.settings) };
    },
  )
  .handler(async ({ data, context }): Promise<ProductChannelSettingsDTO> => {
    // Hardening RBAC server-side (a UI não é barreira de segurança).
    await requireServerPermission(context, "products.update", {
      companyId: data.companyId,
      action: "pricing.channel_settings.save",
      module: "pricing",
    });
    const upd = await context.supabase
      .from("products")
      .update({ channel_pricing_settings: data.settings as unknown as never })
      .eq("company_id", data.companyId)
      .eq("id", data.productId);
    if (upd.error) throw upd.error;
    return data.settings;
  });
