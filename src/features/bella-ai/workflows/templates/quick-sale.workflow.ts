/**
 * Template: Venda rápida.
 *  1. Selecionar cliente
 *  2. Selecionar produtos
 *  3. Registrar pagamento
 *  4. Finalizar venda
 */

import { defineWorkflow } from "../BellaWorkflow";

export const quickSaleWorkflow = defineWorkflow({
  workflowId: "sale.quick",
  name: "Venda rápida",
  description: "Selecionar cliente, produtos, pagamento e finalizar a venda.",
  steps: [
    {
      id: "select-customer",
      name: "Selecionar cliente",
      skillId: "customer.select",
      buildPayload: ({ collectedParameters }) => ({
        customerId: collectedParameters.customerId,
        query: collectedParameters.customerQuery,
      }),
      extractOutputs: (result) => {
        const data = (result.data ?? {}) as Record<string, unknown>;
        return { customerId: data.id ?? data.customerId };
      },
    },
    {
      id: "select-products",
      name: "Selecionar produtos",
      skillId: "sale.add_items",
      buildPayload: ({ collectedParameters, previousOutputs }) => ({
        customerId: previousOutputs.customerId,
        items: collectedParameters.items ?? [],
      }),
      extractOutputs: (result) => {
        const data = (result.data ?? {}) as Record<string, unknown>;
        return { saleId: data.id ?? data.saleId };
      },
    },
    {
      id: "register-payment",
      name: "Registrar pagamento",
      skillId: "sale.register_payment",
      buildPayload: ({ collectedParameters, previousOutputs }) => ({
        saleId: previousOutputs.saleId ?? collectedParameters.saleId,
        method: collectedParameters.paymentMethod,
        amount: collectedParameters.paymentAmount,
      }),
    },
    {
      id: "finalize-sale",
      name: "Finalizar venda",
      skillId: "sale.finalize",
      requiresConfirmation: true,
      buildPayload: ({ previousOutputs, collectedParameters }) => ({
        saleId: previousOutputs.saleId ?? collectedParameters.saleId,
      }),
    },
  ],
});
