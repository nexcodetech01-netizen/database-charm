/**
 * AI-003 — Multi-step Workflows: contratos canônicos.
 *
 * Regras (§ do prompt AI-003):
 *   - Nenhum workflow executa automaticamente. `requiresConfirmation=true`.
 *   - Cada workflow tem 2 etapas visíveis: discovery (read-only) + execution.
 *   - Discovery só consulta Use Cases via `ToolExecutors` (Application Layer).
 *   - Execution itera item-a-item chamando 1 SAFE ACTION (mutating) por vez.
 *     Falha em 1 item NUNCA aborta o workflow — registra e continua.
 *   - Nada de batch SQL, nada de bypass, nada de operação financeira.
 */
import { z } from "zod";

export const WORKFLOW_PROPOSAL_VERSION = "WorkflowProposal.v1" as const;
export const WORKFLOW_REPORT_VERSION = "WorkflowReport.v1" as const;

// Allow-list — apenas workflows comerciais desta sprint.
export const WORKFLOWS = [
  "reviewCategoryPrices",
  "reviewProductsWithPendingSuggestion",
  "reviewProductsBelowMargin",
] as const;
export type WorkflowId = (typeof WORKFLOWS)[number];

export const workflowImpactSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  tone: z.enum(["neutral", "positive", "negative", "warning"]).optional(),
});
export type WorkflowImpact = z.infer<typeof workflowImpactSchema>;

export const workflowRiskSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});
export type WorkflowRisk = z.infer<typeof workflowRiskSchema>;

export const workflowTargetSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1),
  currentPriceCents: z.number(),
  recommendedPriceCents: z.number(),
  differenceCents: z.number(),
  primaryReason: z.string().min(1),
});
export type WorkflowTarget = z.infer<typeof workflowTargetSchema>;

export const workflowProposalSchema = z.object({
  version: z.literal(WORKFLOW_PROPOSAL_VERSION),
  proposalId: z.string().min(1),
  workflowId: z.enum(WORKFLOWS),
  title: z.string().min(1),
  summary: z.string().min(1),
  impact: z.array(workflowImpactSchema),
  risks: z.array(workflowRiskSchema),
  scopes: z.array(z.string()),
  targets: z.array(workflowTargetSchema),
  totalItems: z.number().nonnegative(),
  estimatedRevenueDeltaCents: z.number(),
  payload: z.record(z.string(), z.unknown()),
  requiresConfirmation: z.literal(true),
  createdAt: z.string().min(1),
  companyId: z.string().min(1),
});
export type WorkflowProposal = z.infer<typeof workflowProposalSchema>;

export type WorkflowItemStatus = "updated" | "skipped" | "failed";

export const workflowItemResultSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["updated", "skipped", "failed"]),
  previousPriceCents: z.number().optional(),
  appliedPriceCents: z.number().optional(),
  explainId: z.string().optional(),
  decisionId: z.string().optional(),
  reason: z.string().optional(),
  error: z.string().optional(),
  durationMs: z.number().nonnegative(),
});
export type WorkflowItemResult = z.infer<typeof workflowItemResultSchema>;

export const workflowReportSchema = z.object({
  version: z.literal(WORKFLOW_REPORT_VERSION),
  proposalId: z.string().min(1),
  workflowId: z.enum(WORKFLOWS),
  status: z.enum(["executed", "cancelled", "failed"]),
  companyId: z.string().min(1),
  productsProcessed: z.number().nonnegative(),
  productsUpdated: z.number().nonnegative(),
  productsSkipped: z.number().nonnegative(),
  productsFailed: z.number().nonnegative(),
  executionTimeMs: z.number().nonnegative(),
  appliedRevenueDeltaCents: z.number(),
  items: z.array(workflowItemResultSchema),
  alreadyAudited: z.boolean(),
});
export type WorkflowReport = z.infer<typeof workflowReportSchema>;
