/**
 * SalesWorkflow — template declarativo de venda conduzida pela Bella.
 * Cada step aponta para uma Skill JÁ existente no BellaSkillRegistry
 * (ou para uma futura Skill de venda). O registro é opt-in via
 * `registerSalesCopilotWorkflow()` — se alguma Skill referenciada não
 * existir, o BellaWorkflowRegistry rejeita e o Copilot cai no modo
 * conversacional, sem tentar duplicar lógica.
 */

import { defineWorkflow } from "../workflows/BellaWorkflow";
import { BellaWorkflowRegistry } from "../workflows/BellaWorkflowRegistry";
import { BellaSkillRegistry } from "../skills/registry";
import type { BellaWorkflowDefinition } from "../workflows/BellaWorkflowTypes";

export const SALES_COPILOT_WORKFLOW_ID = "sales.copilot";

export const salesCopilotWorkflow: BellaWorkflowDefinition = defineWorkflow({
  workflowId: SALES_COPILOT_WORKFLOW_ID,
  name: "Venda conduzida pela Bella",
  description:
    "Descoberta → cliente → produtos → orçamento → resumo → confirmação → pedido → pagamento.",
  steps: [
    {
      id: "find-customer",
      name: "Encontrar cliente",
      skillId: "customer.find",
      buildPayload: ({ collectedParameters }) => ({
        query: collectedParameters.customerQuery,
        id: collectedParameters.customerId,
      }),
      extractOutputs: (result) => {
        const data = (result.data ?? {}) as Record<string, unknown>;
        return { customerId: data.id ?? data.customerId ?? null };
      },
    },
    {
      id: "create-quote",
      name: "Montar orçamento",
      skillId: "quote.create",
      buildPayload: ({ collectedParameters, previousOutputs }) => ({
        title: collectedParameters.quoteTitle ?? "Orçamento Bella",
        customerId: previousOutputs.customerId ?? collectedParameters.customerId,
        estimatedValue: collectedParameters.grandTotal ?? 0,
        description: collectedParameters.notes,
      }),
      extractOutputs: (result) => {
        const data = (result.data ?? {}) as Record<string, unknown>;
        return { quoteId: data.id ?? data.quoteId ?? null };
      },
    },
  ],
});

/**
 * Registra o template se — e somente se — todas as Skills referenciadas
 * já existirem. Retorna false silenciosamente caso contrário, mantendo
 * o Copilot funcional em modo conversacional puro.
 */
export function registerSalesCopilotWorkflow(): boolean {
  const missing = salesCopilotWorkflow.steps
    .map((s) => s.skillId)
    .filter((id) => !BellaSkillRegistry.has(id));
  if (missing.length > 0) return false;
  try {
    BellaWorkflowRegistry.register(salesCopilotWorkflow);
    return true;
  } catch {
    return false;
  }
}
