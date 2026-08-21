/**
 * Metadados de Skills enviados ao LLM.
 *
 * Nunca envia código-fonte ou implementações — apenas o mínimo necessário
 * para o modelo identificar intenção e extrair parâmetros.
 */
// Importação removida para evitar vazamento do Registry (e suas dependências server-side) no bundle do cliente.
// O catálogo deve ser injetado ou carregado dinamicamente apenas no servidor.

export interface SkillCatalogParameter {
  name: string;
  type: string;
  required: boolean;
  hint?: string;
}

export interface SkillCatalogEntry {
  id: string;
  name: string;
  module: string;
  description: string;
  requiresConfirmation: boolean;
  parameters: SkillCatalogParameter[];
  examples?: string[];
}

/**
 * Constrói o catálogo a partir do Registry client-side.
 * Ordena por módulo → id para determinismo.
 */
export function buildSkillsCatalog(registry?: any): SkillCatalogEntry[] {
  if (!registry && typeof window !== 'undefined') {
    console.warn("[buildSkillsCatalog] Registry not provided in client context. Returning empty catalog.");
    return [];
  }
  
  const targetRegistry = registry;
  if (!targetRegistry) return [];

  return (targetRegistry.list() as any[])
    .map((skill) => ({
      id: skill.id,
      name: skill.name,
      module: skill.module,
      description: skill.description,
      requiresConfirmation: Boolean(skill.requiresConfirmation),
      parameters: [],
    }))
    .sort((a, b) =>
      a.module === b.module ? a.id.localeCompare(b.id) : a.module.localeCompare(b.module),
    );
}
