import { supabase } from "@/integrations/supabase/client";
import type { PaymentMethodFee, PaymentMethodFeeUpdate } from "../types";

export const paymentMethodsService = {
  async list(companyId: string): Promise<PaymentMethodFee[]> {
    const { data, error } = await supabase
      .from("payment_method_fees")
      .select("*")
      .eq("company_id", companyId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []) as PaymentMethodFee[];
  },

  async update(patch: PaymentMethodFeeUpdate): Promise<PaymentMethodFee> {
    const { id, ...rest } = patch;
    const { data, error } = await supabase
      .from("payment_method_fees")
      .update(rest)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data as PaymentMethodFee;
  },

  async updateMany(patches: PaymentMethodFeeUpdate[]): Promise<void> {
    // Executa updates em sequência (poucas linhas — sempre <= ~10 por empresa).
    for (const p of patches) {
      await this.update(p);
    }
  },
};
