import { supabase } from "@/integrations/supabase/client";
import type {
  AssistantAlert,
  AssistantAlertInsert,
  AssistantAlertUpdate,
  AlertStatus,
} from "../types";

/**
 * Alerts Service — alertas inteligentes gerados pela Bella IA
 * (estoque baixo, cliente inativo, fluxo negativo, etc.).
 *
 * Sprint 14: apenas CRUD. A geração automática por regras será feita
 * em sprints futuras (via jobs/triggers).
 */
export const alertsService = {
  async list(companyId: string, status?: AlertStatus): Promise<AssistantAlert[]> {
    let q = supabase
      .from("assistant_alerts")
      .select("*")
      .eq("company_id", companyId)
      .order("triggered_at", { ascending: false });
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async create(payload: AssistantAlertInsert): Promise<AssistantAlert> {
    const { data, error } = await supabase
      .from("assistant_alerts")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, patch: AssistantAlertUpdate): Promise<AssistantAlert> {
    const { data, error } = await supabase
      .from("assistant_alerts")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async acknowledge(id: string) {
    return this.update(id, { status: "acknowledged" });
  },

  async resolve(id: string) {
    return this.update(id, { status: "resolved", resolved_at: new Date().toISOString() });
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("assistant_alerts").delete().eq("id", id);
    if (error) throw error;
  },

  async countActive(companyId: string): Promise<number> {
    const { count, error } = await supabase
      .from("assistant_alerts")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .in("status", ["open", "acknowledged"]);
    if (error) throw error;
    return count ?? 0;
  },
};
