import { supabase } from "@/integrations/supabase/client";
import type {
  MarketingCampaign,
  MarketingCampaignInsert,
  MarketingCampaignUpdate,
  SegmentFilters,
} from "../types";

export const marketingService = {
  async list(companyId: string, filters?: { status?: string; channel?: string; search?: string }) {
    let q = supabase
      .from("marketing_campaigns")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (filters?.status) q = q.eq("status", filters.status);
    if (filters?.channel) q = q.eq("channel", filters.channel);
    if (filters?.search) q = q.ilike("name", `%${filters.search}%`);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as MarketingCampaign[];
  },

  async get(id: string) {
    const { data, error } = await supabase
      .from("marketing_campaigns")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as MarketingCampaign;
  },

  async create(input: MarketingCampaignInsert) {
    const { data, error } = await supabase
      .from("marketing_campaigns")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    if (data) {
      await supabase.from("crm_events").insert({
        company_id: data.company_id,
        campaign_id: data.id,
        event_type: "campaign_created",
        description: `Campanha criada: ${data.name}`,
      });
    }
    return data as MarketingCampaign;
  },

  async update(id: string, patch: MarketingCampaignUpdate) {
    const { data, error } = await supabase
      .from("marketing_campaigns")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as MarketingCampaign;
  },

  async remove(id: string) {
    const { error } = await supabase.from("marketing_campaigns").delete().eq("id", id);
    if (error) throw error;
  },

  async metrics(companyId: string) {
    const [campaignsRes, customersRes, oppsRes] = await Promise.all([
      supabase
        .from("marketing_campaigns")
        .select("id,status,leads_count,conversions_count,revenue_generated,budget")
        .eq("company_id", companyId),
      supabase
        .from("customers")
        .select("id,created_at,status", { count: "exact", head: true })
        .eq("company_id", companyId),
      supabase
        .from("opportunities")
        .select("id,status")
        .eq("company_id", companyId),
    ]);
    if (campaignsRes.error) throw campaignsRes.error;
    if (customersRes.error) throw customersRes.error;
    if (oppsRes.error) throw oppsRes.error;

    const campaigns = campaignsRes.data ?? [];
    const opps = oppsRes.data ?? [];
    const leadsCount = campaigns.reduce((s, c) => s + Number(c.leads_count ?? 0), 0);
    const conversionsCount = campaigns.reduce((s, c) => s + Number(c.conversions_count ?? 0), 0);
    const revenue = campaigns.reduce((s, c) => s + Number(c.revenue_generated ?? 0), 0);
    const activeCampaigns = campaigns.filter((c) =>
      ["running", "scheduled"].includes(c.status),
    ).length;
    const wonOpps = opps.filter((o) => o.status === "won").length;
    const totalOpps = opps.length;
    const conversion = totalOpps > 0 ? (wonOpps / totalOpps) * 100 : 0;
    return {
      totalCampaigns: campaigns.length,
      activeCampaigns,
      leads: leadsCount,
      conversions: conversionsCount,
      conversionRate: conversion,
      revenueGenerated: revenue,
      totalCustomers: customersRes.count ?? 0,
    };
  },

  async segmentCustomers(companyId: string, filters: SegmentFilters) {
    let q = supabase
      .from("customers")
      .select("id,name,email,phone,city,state,segment,last_interaction_at,created_at")
      .eq("company_id", companyId);
    if (filters.city) q = q.ilike("city", `%${filters.city}%`);
    if (filters.state) q = q.eq("state", filters.state);
    if (filters.segment) q = q.eq("segment", filters.segment);
    if (filters.purchasedWithinDays != null) {
      const since = new Date(
        Date.now() - filters.purchasedWithinDays * 86400000,
      ).toISOString();
      q = q.gte("last_interaction_at", since);
    }
    if (filters.neverPurchased) {
      q = q.is("last_interaction_at", null);
    }
    const { data, error } = await q.order("name");
    if (error) throw error;
    let rows = data ?? [];

    // Aggregate spend from sales when ticket/total filters are used.
    if (filters.minAverageTicket != null || filters.minTotalSpent != null) {
      const salesRes = await supabase
        .from("sales")
        .select("customer_id,grand_total")
        .eq("company_id", companyId)
        .eq("status", "paid");
      if (salesRes.error) throw salesRes.error;
      const stats = new Map<string, { total: number; count: number }>();
      (salesRes.data ?? []).forEach((s) => {
        if (!s.customer_id) return;
        const cur = stats.get(s.customer_id) ?? { total: 0, count: 0 };
        cur.total += Number(s.grand_total ?? 0);
        cur.count += 1;
        stats.set(s.customer_id, cur);
      });
      rows = rows.filter((c) => {
        const st = stats.get(c.id);
        const total = st?.total ?? 0;
        const avg = st && st.count > 0 ? total / st.count : 0;
        if (filters.minTotalSpent != null && total < filters.minTotalSpent) return false;
        if (filters.minAverageTicket != null && avg < filters.minAverageTicket) return false;
        return true;
      });
    }
    return rows;
  },
};
