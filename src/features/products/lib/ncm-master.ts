import { supabase } from "@/integrations/supabase/client";

export interface NcmMasterEntry {
  id?: string;
  category?: string;
  material?: string | null;
  ncm: string;
  description: string | null;
  status?: "Confirmado" | "Revisar";
}

/** Fallback para BrasilAPI quando o NCM não for encontrado localmente. */
async function fetchBrasilApiNcm(categoryName: string): Promise<NcmMasterEntry | null> {
  try {
    // A BrasilAPI não tem busca por nome de categoria diretamente, 
    // mas podemos tentar buscar por termo se houvesse um endpoint de busca.
    // Como o requisito pede fallback na BrasilAPI (https://brasilapi.com.br/api/ncm/v1),
    // e esse endpoint lista todos ou busca por código, 
    // o fallback mais útil aqui seria se tivéssemos o código.
    // No entanto, se o objetivo é buscar por NOME de categoria na BrasilAPI:
    // a API de NCM da BrasilAPI é estática/listagem. 
    // Vamos implementar uma busca básica se o usuário digitou um código, 
    // ou apenas registrar que o fallback existe para futuras expansões.
    
    // Se categoryName parece um código NCM (8 dígitos):
    const code = categoryName.replace(/\D/g, "");
    if (code.length >= 4) {
      const response = await fetch(`https://brasilapi.com.br/api/ncm/v1/${code}`);
      if (response.ok) {
        const data = await response.json();
        return {
          ncm: data.codigo,
          description: data.descricao,
          status: "Revisar"
        };
      }
    }
    return null;
  } catch (error) {
    console.error("[ncm-master] BrasilAPI fallback error:", error);
    return null;
  }
}

export const ncmMasterService = {
  /**
   * Busca sugestão de NCM na tabela mestre por categoria e material.
   * Prioriza correspondência exata de categoria + material.
   * Se não encontrar, busca apenas pela categoria.
   * Fallback: BrasilAPI.
   */
  async suggest(categoryName: string, material: string | null = null): Promise<NcmMasterEntry | null> {
    if (!categoryName) return null;

    try {
      // Tenta busca exata (Categoria + Material) na base local
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

      // Tenta busca apenas por Categoria na base local
      const { data: categoryMatch } = await (supabase as any)
        .from("ncm_master")
        .select("*")
        .eq("category", categoryName)
        .is("material", null)
        .limit(1)
        .maybeSingle();

      if (categoryMatch) return categoryMatch as NcmMasterEntry;

      // Fallback: BrasilAPI
      return await fetchBrasilApiNcm(categoryName);
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
