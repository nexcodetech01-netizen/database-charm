import { supabase } from "@/integrations/supabase/client";
import type {
  BellaPayConfig,
  BellaPayCharge,
  BellaPayChargeWithMeta,
  BellaPayEnvironment,
  BellaPayMetrics,
} from "../types";

export const bellaPayService = {
  async getConfig(companyId: string): Promise<BellaPayConfig | null> {
    const { data, error } = await supabase
      .from("bella_pay_config")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw error;
    return data as BellaPayConfig | null;
  },

  async upsertConfig(input: {
    companyId: string;
    apiKeySandbox?: string | null;
    apiKeyProduction?: string | null;
    environment: BellaPayEnvironment;
    creditCardAbsorbFee?: boolean;
    creditCardFeePercent?: number;
    creditCardMaxInstallments?: number;
    defaultAccountId?: string | null;
  }): Promise<BellaPayConfig> {
    const patch = {
      company_id: input.companyId,
      environment: input.environment,
      ...(input.apiKeySandbox !== undefined ? { api_key_sandbox: input.apiKeySandbox } : {}),
      ...(input.apiKeyProduction !== undefined
        ? { api_key_production: input.apiKeyProduction }
        : {}),
      ...(input.creditCardAbsorbFee !== undefined
        ? { credit_card_absorb_fee: input.creditCardAbsorbFee }
        : {}),
      ...(input.creditCardFeePercent !== undefined
        ? { credit_card_fee_percent: input.creditCardFeePercent }
        : {}),
      ...(input.creditCardMaxInstallments !== undefined
        ? { credit_card_max_installments: input.creditCardMaxInstallments }
        : {}),
      ...(input.defaultAccountId !== undefined
        ? { default_account_id: input.defaultAccountId }
        : {}),
    };

    console.log("[bellaPayService] upsertConfig starting", {
      companyId: patch.company_id,
      environment: patch.environment,
      hasSandbox: !!patch.api_key_sandbox,
      hasProduction: !!patch.api_key_production
    });

    const { data, error } = await supabase
      .from("bella_pay_config")
      .upsert(patch, { onConflict: "company_id" })
      .select()
      .single();

    if (error) {
      console.error("[bellaPayService] upsertConfig error", error);
      throw error;
    }

    console.log("[bellaPayService] upsertConfig success", {
      id: data.id,
      companyId: data.company_id
    });
    return data as BellaPayConfig;
  },


  async listCharges(companyId: string): Promise<BellaPayChargeWithMeta[]> {
    const { data, error } = await supabase
      .from("bella_pay_charges")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    const rows = (data ?? []) as BellaPayCharge[];
    if (rows.length === 0) return [];

    const customerIds = Array.from(
      new Set(rows.map((r) => r.customer_id).filter((v): v is string => !!v)),
    );
    const saleIds = Array.from(
      new Set(rows.map((r) => r.sale_id).filter((v): v is string => !!v)),
    );

    const [cusRes, saleRes] = await Promise.all([
      customerIds.length
        ? supabase.from("customers").select("id,name").in("id", customerIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
      saleIds.length
        ? supabase.from("sales").select("id,number").in("id", saleIds)
        : Promise.resolve({ data: [] as { id: string; number: number }[], error: null }),
    ]);
    if (cusRes.error) throw cusRes.error;
    if (saleRes.error) throw saleRes.error;

    const cusMap = new Map<string, string>((cusRes.data ?? []).map((c) => [c.id, c.name]));
    const saleMap = new Map<string, number>(
      (saleRes.data ?? []).map((s) => [s.id, Number(s.number)]),
    );

    return rows.map<BellaPayChargeWithMeta>((r) => ({
      ...r,
      customer_name: r.customer_id ? (cusMap.get(r.customer_id) ?? null) : null,
      sale_number: r.sale_id ? (saleMap.get(r.sale_id) ?? null) : null,
    }));
  },

  async metrics(companyId: string): Promise<BellaPayMetrics> {
    const { data, error } = await supabase
      .from("bella_pay_charges")
      .select("status, value, created_at, paid_at")
      .eq("company_id", companyId);
    if (error) throw error;
    const rows = data ?? [];

    const isOpen = (s: string) => ["PENDING", "AWAITING_RISK_ANALYSIS"].includes(s);
    const isReceived = (s: string) => ["RECEIVED", "CONFIRMED"].includes(s);
    const isOverdue = (s: string) => s === "OVERDUE";
    const isCanceled = (s: string) => ["CANCELED", "REFUNDED"].includes(s);

    const sumWhere = (pred: (r: { status: string; value: number | null }) => boolean) =>
      rows
        .filter((r) => pred({ status: String(r.status), value: r.value }))
        .reduce((acc, r) => acc + Number(r.value ?? 0), 0);

    const open = rows.filter((r) => isOpen(String(r.status))).length;
    const openValue = sumWhere((r) => isOpen(r.status));
    const received = rows.filter((r) => isReceived(String(r.status))).length;
    const receivedValue = sumWhere((r) => isReceived(r.status));
    const overdue = rows.filter((r) => isOverdue(String(r.status))).length;
    const overdueValue = sumWhere((r) => isOverdue(r.status));
    const canceled = rows.filter((r) => isCanceled(String(r.status))).length;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthReceivedValue = rows
      .filter((r) => {
        if (!isReceived(String(r.status))) return false;
        if (!r.paid_at) return false;
        const d = new Date(r.paid_at);
        return d >= startOfMonth && d <= now;
      })
      .reduce((acc, r) => acc + Number(r.value ?? 0), 0);

    const paidWithDates = rows.filter(
      (r) => isReceived(String(r.status)) && r.paid_at && r.created_at,
    );
    const averagePaymentDays = paidWithDates.length
      ? paidWithDates.reduce((acc, r) => {
          const c = new Date(r.created_at!).getTime();
          const p = new Date(r.paid_at!).getTime();
          return acc + Math.max(0, (p - c) / 86400000);
        }, 0) / paidWithDates.length
      : null;

    const denom = rows.length - canceled;
    const conversionRate = denom > 0 ? received / denom : 0;

    return {
      total: rows.length,
      open,
      openValue,
      received,
      receivedValue,
      overdue,
      overdueValue,
      canceled,
      monthReceivedValue,
      averagePaymentDays,
      conversionRate,
    };
  },
};
