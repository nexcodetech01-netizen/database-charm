import { supabase } from "@/integrations/supabase/client";
import type {
  AssistantRecommendation,
  AssistantRecommendationInsert,
  AssistantRecommendationUpdate,
  RecommendationStatus,
} from "../types";

/**
 * Recommendations Service — recomendações estratégicas geradas pela Bella IA.
 *
 * Sprint 14: apenas CRUD. Geração automática virá em sprints futuras.
 */
export const recommendationsService = {
  async list(
    companyId: string,
    status?: RecommendationStatus,
  ): Promise<AssistantRecommendation[]> {
    let q = supabase
      .from("assistant_recommendations")
      .select("*")
      .eq("company_id", companyId)
      .order("generated_at", { ascending: false });
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async create(payload: AssistantRecommendationInsert): Promise<AssistantRecommendation> {
    const { data, error } = await supabase
      .from("assistant_recommendations")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async update(
    id: string,
    patch: AssistantRecommendationUpdate,
  ): Promise<AssistantRecommendation> {
    const { data, error } = await supabase
      .from("assistant_recommendations")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async accept(id: string) {
    return this.update(id, { status: "accepted" });
  },

  async dismiss(id: string) {
    return this.update(id, { status: "dismissed", resolved_at: new Date().toISOString() });
  },

  async markDone(id: string) {
    return this.update(id, { status: "done", resolved_at: new Date().toISOString() });
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from("assistant_recommendations")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async countPending(companyId: string): Promise<number> {
    const { count, error } = await supabase
      .from("assistant_recommendations")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "pending");
    if (error) throw error;
    return count ?? 0;
  },
};
