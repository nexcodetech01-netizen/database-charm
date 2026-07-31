/**
 * Template: Reposição de estoque.
 *  1. Selecionar produto
 *  2. Informar quantidade
 *  3. Atualizar estoque
 */

import { defineWorkflow } from "../BellaWorkflow";

export const inventoryRestockWorkflow = defineWorkflow({
  workflowId: "inventory.restock",
  name: "Reposição de estoque",
  description: "Selecionar produto, informar quantidade e atualizar o estoque.",
  steps: [
    {
      id: "select-product",
      name: "Selecionar produto",
      skillId: "product.select",
      buildPayload: ({ collectedParameters }) => ({
        productId: collectedParameters.productId,
        query: collectedParameters.productQuery,
      }),
      extractOutputs: (result) => {
        const data = (result.data ?? {}) as Record<string, unknown>;
        return { productId: data.id ?? data.productId };
      },
    },
    {
      id: "inform-quantity",
      name: "Informar quantidade",
      skillId: "product.set_restock_quantity",
      buildPayload: ({ collectedParameters, previousOutputs }) => ({
        productId: previousOutputs.productId ?? collectedParameters.productId,
        quantity: collectedParameters.quantity,
      }),
    },
    {
      id: "update-stock",
      name: "Atualizar estoque",
      skillId: "inventory.restock",
      requiresConfirmation: true,
      buildPayload: ({ collectedParameters, previousOutputs }) => ({
        productId: previousOutputs.productId ?? collectedParameters.productId,
        quantity: collectedParameters.quantity,
      }),
    },
  ],
});
