import { supabase } from "@/integrations/supabase/client";
import type {
  AssistantContext,
  AssistantContextInsert,
  ContextType,
} from "../types";

/**
 * Context Service — coleta e organização de contexto dos módulos
 * para consumo pela Bella IA.
 *
 * Sprint 14: apenas persistência de snapshots. A coleta real por módulo
 * será feita em sprints futuras (products/sales/finance/etc.).
 */
export const contextService = {
  async list(companyId: string, type?: ContextType): Promise<AssistantContext[]> {
    let q = supabase
      .from("assistant_context")
      .select("*")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false });
    if (type) q = q.eq("context_type", type);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async upsertSnapshot(payload: AssistantContextInsert): Promise<AssistantContext> {
    const { data, error } = await supabase
      .from("assistant_context")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("assistant_context").delete().eq("id", id);
    if (error) throw error;
  },

  /**
   * Placeholder para futura coleta agregada de todos os módulos.
   * Nesta sprint apenas retorna o esqueleto vazio por tipo.
   */
  async collectAll(companyId: string): Promise<Record<ContextType, AssistantContext[]>> {
    const all = await this.list(companyId);
    const grouped = {
      products: [],
      purchases: [],
      inventory: [],
      customers: [],
      crm: [],
      sales: [],
      finance: [],
      agenda: [],
      marketing: [],
      reports: [],
      global: [],
    } as Record<ContextType, AssistantContext[]>;
    for (const ctx of all) {
      const key = ctx.context_type as ContextType;
      if (grouped[key]) grouped[key].push(ctx);
    }
    return grouped;
  },
};
