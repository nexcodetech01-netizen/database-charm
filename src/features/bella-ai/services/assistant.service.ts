import { supabase } from "@/integrations/supabase/client";
import type {
  AssistantConversation,
  AssistantConversationInsert,
  AssistantConversationUpdate,
  AssistantMessage,
  AssistantMessageInsert,
  AIProvider,
} from "../types";
import { getProvider } from "../providers";

/**
 * Assistant Service — orquestração do chat da Bella IA.
 *
 * Sprint 14: apenas gerenciamento de conversas e mensagens.
 * A chamada real ao LLM (send) apenas prepara a request; a integração
 * concreta com provedores acontecerá em sprints futuras.
 */
export const assistantService = {
  // -------- Conversations --------
  async listConversations(companyId: string): Promise<AssistantConversation[]> {
    const { data, error } = await supabase
      .from("assistant_conversations")
      .select("*")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getConversation(id: string): Promise<AssistantConversation | null> {
    const { data, error } = await supabase
      .from("assistant_conversations")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async createConversation(payload: AssistantConversationInsert): Promise<AssistantConversation> {
    const { data, error } = await supabase
      .from("assistant_conversations")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async updateConversation(
    id: string,
    patch: AssistantConversationUpdate,
  ): Promise<AssistantConversation> {
    const { data, error } = await supabase
      .from("assistant_conversations")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async archiveConversation(id: string) {
    return this.updateConversation(id, { status: "archived" });
  },

  async deleteConversation(id: string): Promise<void> {
    const { error } = await supabase.from("assistant_conversations").delete().eq("id", id);
    if (error) throw error;
  },

  // -------- Messages --------
  async listMessages(conversationId: string): Promise<AssistantMessage[]> {
    const { data, error } = await supabase
      .from("assistant_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async addMessage(payload: AssistantMessageInsert): Promise<AssistantMessage> {
    const { data, error } = await supabase
      .from("assistant_messages")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  // -------- Send (stub) --------
  /**
   * Prepara a chamada ao provedor selecionado. Nesta sprint apenas
   * valida a existência do adapter — nenhum provedor está integrado.
   */
  async prepareSend(provider: AIProvider, model?: string): Promise<{ provider: AIProvider; model: string }> {
    const adapter = getProvider(provider);
    return { provider: adapter.provider, model: model ?? adapter.defaultModel };
  },
};
