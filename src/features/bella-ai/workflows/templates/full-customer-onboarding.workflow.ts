/**
 * Template: Cadastro completo de cliente.
 *  1. Cadastrar cliente
 *  2. Criar orçamento
 *  3. Adicionar produtos
 *  4. Finalizar orçamento
 *
 * Cada Step referencia UMA Skill existente — sem regra nova.
 * Os `skillId` devem existir no BellaSkillRegistry; a validação
 * do Registry rejeita o template caso contrário.
 */

import { defineWorkflow } from "../BellaWorkflow";

export const fullCustomerOnboardingWorkflow = defineWorkflow({
  workflowId: "customer.full_onboarding",
  name: "Cadastro completo de cliente",
  description:
    "Fluxo composto: cria o cliente, abre um orçamento, adiciona produtos e finaliza.",
  steps: [
    {
      id: "create-customer",
      name: "Cadastrar cliente",
      skillId: "customer.create",
      buildPayload: ({ collectedParameters }) => ({
        name: collectedParameters.customerName,
        document: collectedParameters.customerDocument,
        phone: collectedParameters.customerPhone,
        email: collectedParameters.customerEmail,
      }),
      extractOutputs: (result) => {
        const data = (result.data ?? {}) as Record<string, unknown>;
        return { customerId: data.id ?? data.customerId };
      },
    },
    {
      id: "create-quote",
      name: "Criar orçamento",
      skillId: "quote.create",
      buildPayload: ({ collectedParameters, previousOutputs }) => ({
        customerId: previousOutputs.customerId ?? collectedParameters.customerId,
      }),
      extractOutputs: (result) => {
        const data = (result.data ?? {}) as Record<string, unknown>;
        return { quoteId: data.id ?? data.quoteId };
      },
    },
    {
      id: "add-products",
      name: "Adicionar produtos",
      skillId: "quote.add_items",
      buildPayload: ({ collectedParameters, previousOutputs }) => ({
        quoteId: previousOutputs.quoteId ?? collectedParameters.quoteId,
        items: collectedParameters.items ?? [],
      }),
    },
    {
      id: "finalize-quote",
      name: "Finalizar orçamento",
      skillId: "quote.finalize",
      requiresConfirmation: true,
      buildPayload: ({ collectedParameters, previousOutputs }) => ({
        quoteId: previousOutputs.quoteId ?? collectedParameters.quoteId,
      }),
    },
  ],
});
