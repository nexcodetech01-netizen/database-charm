import { supabase } from "@/integrations/supabase/client";

export interface NcmMasterEntry {
  id: string;
  category: string;
  material: string | null;
  ncm: string;
  description: string | null;
  status: "Confirmado" | "Revisar";
}

export const ncmMasterService = {
  /**
   * Busca sugestão de NCM na tabela mestre por categoria e material.
   * Prioriza correspondência exata de categoria + material.
   * Se não encontrar, busca apenas pela categoria.
   */
  async suggest(categoryName: string, material: string | null = null): Promise<NcmMasterEntry | null> {
    if (!categoryName) return null;

    try {
      // Tenta busca exata (Categoria + Material)
      if (material) {
        const { data: exactMatch } = await (supabase as any)
          .from("ncm_master")
          .select("*")
          .eq("category", categoryName)
          .eq("material", material)
          .eq("status", "Confirmado")
          .limit(1)
          .maybeSingle();

        if (exactMatch) return exactMatch as NcmMasterEntry;
      }

      // Tenta busca apenas por Categoria (ou se material for nulo)
      const { data: categoryMatch } = await (supabase as any)
        .from("ncm_master")
        .select("*")
        .eq("category", categoryName)
        .is("material", null)
        .limit(1)
        .maybeSingle();

      return categoryMatch as NcmMasterEntry | null;
    } catch (error) {
      console.error("[ncm-master] Error fetching suggestion:", error);
      return null;
    }
  },

  /**
   * Lista entradas da tabela mestre para gestão.
   */
  async listEntries() {
    const { data, error } = await (supabase as any)
      .from("ncm_master")
      .select("*")
      .order("category", { ascending: true })
      .order("material", { ascending: true });
    
    if (error) throw error;
    return data as NcmMasterEntry[];
  }
};
