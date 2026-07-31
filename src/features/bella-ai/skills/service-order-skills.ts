/**
 * Skill de Ordem de Serviço.
 *
 * O módulo de OS ainda não possui Service no NexOS. Enquanto o Service
 * oficial não existir, esta Skill devolve `module_unavailable` para
 * evitar duplicação de regras de negócio na Bella. Assim que o Service
 * for criado, basta plugá-lo aqui — nenhum outro ponto muda.
 */

import type { BellaSkill } from "./types";
import { skillResult } from "./types";

export const createServiceOrderSkill: BellaSkill = {
  id: "service_order.create",
  name: "Criar OS",
  module: "sales",
  description: "Cria uma nova Ordem de Serviço.",
  canExecute: () => false,
  async execute() {
    return skillResult.unavailable(
      "O módulo de Ordem de Serviço ainda não está disponível no NexOS. Assim que for implementado, esta ação passa a executar automaticamente.",
    );
  },
};

export const serviceOrderSkills: BellaSkill[] = [createServiceOrderSkill];
