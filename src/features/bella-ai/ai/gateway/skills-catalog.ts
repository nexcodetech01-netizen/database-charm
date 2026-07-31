/**
 * Metadados de Skills enviados ao LLM.
 *
 * Nunca envia código-fonte ou implementações — apenas o mínimo necessário
 * para o modelo identificar intenção e extrair parâmetros.
 */
import { BellaSkillRegistry } from "../../skills/registry";

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
export function buildSkillsCatalog(): SkillCatalogEntry[] {
  return BellaSkillRegistry.list()
    .map((skill) => ({
      id: skill.id,
      name: skill.name,
      module: skill.module,
      description: skill.description,
      requiresConfirmation: Boolean(skill.requiresConfirmation),
      // Skills atuais não expõem schema formal — o LLM infere a partir
      // da descrição. Quando o schema formal chegar, popula aqui.
      parameters: [],
    }))
    .sort((a, b) =>
      a.module === b.module ? a.id.localeCompare(b.id) : a.module.localeCompare(b.module),
    );
}
