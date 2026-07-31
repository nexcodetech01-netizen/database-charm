/**
 * Templates iniciais do Bella Workflow Engine.
 *
 * Nenhum template é auto-registrado neste import — o consumidor
 * (bootstrap da Bella) chama `registerBellaWorkflowTemplates()`
 * explicitamente. Isso mantém o Registry opt-in e evita side-effects
 * silenciosos quando alguma Skill referenciada ainda não existir.
 */

import { BellaWorkflowRegistry } from "../BellaWorkflowRegistry";
import { fullCustomerOnboardingWorkflow } from "./full-customer-onboarding.workflow";
import { quickSaleWorkflow } from "./quick-sale.workflow";
import { inventoryRestockWorkflow } from "./inventory-restock.workflow";

export const bellaWorkflowTemplates = [
  fullCustomerOnboardingWorkflow,
  quickSaleWorkflow,
  inventoryRestockWorkflow,
];

export {
  fullCustomerOnboardingWorkflow,
  quickSaleWorkflow,
  inventoryRestockWorkflow,
};

/**
 * Registra os templates cujas Skills já estão presentes no
 * BellaSkillRegistry. Templates com Skills faltantes são ignorados
 * e reportados — nunca lançam erro global para não quebrar o boot.
 */
export function registerBellaWorkflowTemplates(): {
  registered: string[];
  skipped: Array<{ workflowId: string; reason: string }>;
} {
  const registered: string[] = [];
  const skipped: Array<{ workflowId: string; reason: string }> = [];
  for (const def of bellaWorkflowTemplates) {
    try {
      BellaWorkflowRegistry.register(def);
      registered.push(def.workflowId);
    } catch (err) {
      skipped.push({
        workflowId: def.workflowId,
        reason: err instanceof Error ? err.message : "erro desconhecido",
      });
    }
  }
  return { registered, skipped };
}
