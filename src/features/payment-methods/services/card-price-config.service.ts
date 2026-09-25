import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_CARD_PRICE_CONFIG,
  normalizeCardPriceConfig,
  type CardPriceConfig,
} from "@/lib/pricing/card-price";

export const cardPriceConfigService = {
  async get(companyId: string): Promise<CardPriceConfig> {
    const { data, error } = await supabase
      .from("company_card_price_config")
      .select("card_fee_percent,max_installments,active")
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw error;
    return data ? normalizeCardPriceConfig(data) : DEFAULT_CARD_PRICE_CONFIG;
  },

  async save(companyId: string, config: CardPriceConfig): Promise<CardPriceConfig> {
    const { data, error } = await supabase
      .from("company_card_price_config")
      .upsert(
        {
          company_id: companyId,
          card_fee_percent: config.cardFeePercent,
          max_installments: config.maxInstallments,
          active: config.active,
        },
        { onConflict: "company_id" },
      )
      .select("card_fee_percent,max_installments,active")
      .single();
    if (error) throw error;
    return normalizeCardPriceConfig(data);
  },
};