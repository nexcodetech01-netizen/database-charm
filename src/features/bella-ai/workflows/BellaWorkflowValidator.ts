/**
 * BellaWorkflowValidator — valida definições de workflow em tempo de registro
 * e antes de executar. Puro. Garante que todo Step aponta para uma Skill
 * existente no BellaSkillRegistry.
 */

import { BellaSkillRegistry } from "../skills/registry";
import type { BellaWorkflowDefinition } from "./BellaWorkflowTypes";

export interface BellaWorkflowValidationResult {
  readonly ok: boolean;
  readonly errors: string[];
}

export function validateDefinition(
  def: BellaWorkflowDefinition,
  registry: typeof BellaSkillRegistry = BellaSkillRegistry,
): BellaWorkflowValidationResult {
  const errors: string[] = [];

  if (!def.workflowId?.trim()) errors.push("workflowId ausente.");
  if (!def.name?.trim()) errors.push("name ausente.");
  if (!Array.isArray(def.steps) || def.steps.length === 0) {
    errors.push("Workflow deve conter ao menos 1 Step.");
  }

  const seenIds = new Set<string>();
  def.steps?.forEach((step, index) => {
    const where = `Step[${index}]`;
    if (!step.id?.trim()) errors.push(`${where}: id ausente.`);
    if (!step.name?.trim()) errors.push(`${where}: name ausente.`);
    if (!step.skillId?.trim()) errors.push(`${where}: skillId ausente.`);
    if (step.id && seenIds.has(step.id)) {
      errors.push(`${where}: id duplicado "${step.id}".`);
    }
    if (step.id) seenIds.add(step.id);
    if (step.skillId && !registry.has(step.skillId)) {
      errors.push(
        `${where}: Skill "${step.skillId}" não registrada. Registre a Skill antes do Workflow.`,
      );
    }
    if (typeof step.buildPayload !== "function") {
      errors.push(`${where}: buildPayload obrigatório.`);
    }
  });

  return { ok: errors.length === 0, errors };
}
