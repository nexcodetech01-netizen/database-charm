/**
 * AI-002 SAFE ACTIONS — contratos canônicos.
 *
 * REGRA CENTRAL (§9.4 do blueprint):
 *   - Toda action passa por `propose(...)` → `ActionProposal.v1`.
 *   - Nenhuma execução ocorre sem confirmação humana explícita.
 *   - Actions **navegacionais** (kind: "navigate") não tocam a Application
 *     Layer — apenas devolvem um href para a UI navegar.
 *   - Actions **mutating** (kind: "mutation") delegam para 1 Use Case da
 *     Application Layer via `ToolExecutors` (nunca acesso direto a repo).
 */
import { z } from "zod";

export const ACTION_PROPOSAL_VERSION = "ActionProposal.v1" as const;
export const ACTION_RESULT_VERSION = "ActionExecutionResult.v1" as const;

// Allow-list explícita (§9 desta sprint). Ordem = ordem de exposição.
export const SAFE_ACTIONS = [
  "applySuggestedPrice",
  "openProduct",
  "openCommercialDashboard",
  "openPricingSimulator",
  "openCategoryPolicy",
  "openCompanyPolicy",
] as const;
export type SafeActionId = (typeof SAFE_ACTIONS)[number];

export type ActionKind = "navigate" | "mutation";

/** Chip informativo mostrado no card de confirmação. */
export const actionImpactSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  tone: z.enum(["neutral", "positive", "negative", "warning"]).optional(),
});
export type ActionImpact = z.infer<typeof actionImpactSchema>;

export const actionRiskSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});
export type ActionRisk = z.infer<typeof actionRiskSchema>;

export const actionProposalSchema = z.object({
  version: z.literal(ACTION_PROPOSAL_VERSION),
  proposalId: z.string().min(1),
  actionId: z.enum(SAFE_ACTIONS),
  kind: z.enum(["navigate", "mutation"]),
  title: z.string().min(1),
  summary: z.string().min(1),
  impact: z.array(actionImpactSchema),
  risks: z.array(actionRiskSchema),
  scopes: z.array(z.string()),
  /** Payload opaco — validado pelo executor da action, não pela UI. */
  payload: z.record(z.string(), z.unknown()),
  /** Para navegações, href resolvido pelo ROUTES catalog. */
  href: z.string().optional(),
  requiresConfirmation: z.literal(true),
  createdAt: z.string().min(1),
  companyId: z.string().min(1),
});
export type ActionProposal = z.infer<typeof actionProposalSchema>;

export type ActionExecutionStatus = "executed" | "cancelled" | "failed";

export const actionExecutionResultSchema = z.object({
  version: z.literal(ACTION_RESULT_VERSION),
  proposalId: z.string().min(1),
  actionId: z.enum(SAFE_ACTIONS),
  status: z.enum(["executed", "cancelled", "failed"]),
  executionTimeMs: z.number().nonnegative(),
  useCase: z.string().optional(),
  alreadyAudited: z.boolean(),
  output: z.unknown().optional(),
  error: z.string().optional(),
});
export type ActionExecutionResult = z.infer<typeof actionExecutionResultSchema>;
