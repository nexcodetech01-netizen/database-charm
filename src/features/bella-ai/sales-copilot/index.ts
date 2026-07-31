/**
 * Bella Sales Copilot — barrel público.
 *
 * Uso mínimo:
 *   import { salesCopilot } from "@/features/bella-ai/sales-copilot";
 *   const res = salesCopilot.start({ tenantId, userId, channel: "chat" });
 *
 * Nenhum consumidor precisa importar Skills/Workflow/Memory manualmente
 * — o Copilot compõe tudo internamente.
 */

export * from "./types";
export * from "./SalesContext";
export * from "./SalesValidator";
export * from "./SalesSummary";
export * from "./SalesConfirmation";
export * from "./SalesConversation";
export * from "./ProductRecommendation";
export * from "./SalesWorkflow";
export { SalesCopilot, salesCopilot } from "./SalesCopilot";
export * from "./hooks";
