import { supabase } from "@/integrations/supabase/client";
import type {
  Opportunity,
  OpportunityInsert,
  OpportunityUpdate,
  PipelineStage,
  PipelineStageInsert,
  CrmEvent,
} from "../types";
import { DEFAULT_PIPELINE_STAGES } from "../types";

export const crmService = {
  async listStages(companyId: string): Promise<PipelineStage[]> {
    const { data, error } = await supabase
      .from("pipeline_stages")
      .select("*")
      .eq("company_id", companyId)
      .order("position", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async ensureDefaultStages(companyId: string): Promise<PipelineStage[]> {
    const existing = await this.listStages(companyId);
    if (existing.length > 0) return existing;
    const rows: PipelineStageInsert[] = DEFAULT_PIPELINE_STAGES.map((s) => ({
      ...s,
      company_id: companyId,
    }));
    const { data, error } = await supabase.from("pipeline_stages").insert(rows).select();
    if (error) throw error;
    return data ?? [];
  },

  async createStage(input: PipelineStageInsert) {
    const { data, error } = await supabase.from("pipeline_stages").insert(input).select().single();
    if (error) throw error;
    return data as PipelineStage;
  },

  async updateStage(id: string, patch: Partial<PipelineStage>) {
    const { data, error } = await supabase
      .from("pipeline_stages")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as PipelineStage;
  },

  async deleteStage(id: string) {
    const { error } = await supabase.from("pipeline_stages").delete().eq("id", id);
    if (error) throw error;
  },

  async listOpportunities(companyId: string, filters?: { search?: string; stageId?: string; status?: string }) {
    let q = supabase
      .from("opportunities")
      .select("*")
      .eq("company_id", companyId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });
    if (filters?.stageId) q = q.eq("stage_id", filters.stageId);
    if (filters?.status) q = q.eq("status", filters.status);
    if (filters?.search) q = q.ilike("title", `%${filters.search}%`);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Opportunity[];
  },

  async getOpportunity(id: string) {
    const { data, error } = await supabase.from("opportunities").select("*").eq("id", id).single();
    if (error) throw error;
    return data as Opportunity;
  },

  async createOpportunity(input: OpportunityInsert) {
    const { data, error } = await supabase.from("opportunities").insert(input).select().single();
    if (error) throw error;
    return data as Opportunity;
  },

  async updateOpportunity(id: string, patch: OpportunityUpdate) {
    const { data, error } = await supabase
      .from("opportunities")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Opportunity;
  },

  async moveOpportunity(id: string, stageId: string, position: number) {
    return this.updateOpportunity(id, { stage_id: stageId, position });
  },

  async closeOpportunity(id: string, status: "won" | "lost", reason?: string) {
    const patch: OpportunityUpdate = {
      status,
      closed_at: new Date().toISOString(),
    };
    if (status === "won") patch.won_reason = reason ?? null;
    if (status === "lost") patch.lost_reason = reason ?? null;
    return this.updateOpportunity(id, patch);
  },

  async deleteOpportunity(id: string) {
    const { error } = await supabase.from("opportunities").delete().eq("id", id);
    if (error) throw error;
  },

  async metrics(companyId: string) {
    const { data, error } = await supabase
      .from("opportunities")
      .select("id,status,estimated_value,probability,stage_id,created_at")
      .eq("company_id", companyId);
    if (error) throw error;
    const rows = data ?? [];
    const open = rows.filter((r) => r.status === "open");
    const won = rows.filter((r) => r.status === "won");
    const lost = rows.filter((r) => r.status === "lost");
    const pipelineValue = open.reduce((s, r) => s + Number(r.estimated_value ?? 0), 0);
    const weighted = open.reduce(
      (s, r) => s + (Number(r.estimated_value ?? 0) * Number(r.probability ?? 0)) / 100,
      0,
    );
    const wonValue = won.reduce((s, r) => s + Number(r.estimated_value ?? 0), 0);
    const closed = won.length + lost.length;
    const conversion = closed > 0 ? (won.length / closed) * 100 : 0;
    return {
      total: rows.length,
      open: open.length,
      won: won.length,
      lost: lost.length,
      pipelineValue,
      weighted,
      wonValue,
      conversion,
    };
  },

  async listEvents(companyId: string, filters?: { customerId?: string; opportunityId?: string; limit?: number }) {
    let q = supabase
      .from("crm_events")
      .select("*")
      .eq("company_id", companyId)
      .order("occurred_at", { ascending: false })
      .limit(filters?.limit ?? 100);
    if (filters?.customerId) q = q.eq("customer_id", filters.customerId);
    if (filters?.opportunityId) q = q.eq("opportunity_id", filters.opportunityId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as CrmEvent[];
  },

  async addNote(companyId: string, note: {
    customer_id?: string | null;
    opportunity_id?: string | null;
    description: string;
    user_id?: string | null;
  }) {
    const { data, error } = await supabase
      .from("crm_events")
      .insert({
        company_id: companyId,
        customer_id: note.customer_id ?? null,
        opportunity_id: note.opportunity_id ?? null,
        event_type: "note",
        description: note.description,
        user_id: note.user_id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as CrmEvent;
  },
};
