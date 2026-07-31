/**
 * Guardrails de Workflows (§ AI-003). Determinísticos.
 *
 * BLOQUEIA:
 *   - Workflow fora da allow-list.
 *   - Verbos destrutivos, financeiros, cancelamentos, estoque.
 *   - Execução sem `confirmed=true`.
 *   - Troca de empresa entre discovery e execução.
 *   - Payloads em lote com múltiplos categoryIds (fase escopa 1 categoria).
 */
import { WORKFLOWS, type WorkflowId, type WorkflowProposal } from "./contracts";

export interface WorkflowGuardResult {
  readonly ok: boolean;
  readonly code?:
    | "workflow_not_allowed"
    | "destructive_blocked"
    | "financial_blocked"
    | "stock_blocked"
    | "batch_blocked"
    | "confirmation_missing"
    | "tenant_mismatch";
  readonly message?: string;
}

const DESTRUCTIVE_RE =
  /\b(delete|remove|apagar|excluir|cancel|estorno|refund|chargeback)\b/i;
const FINANCIAL_RE =
  /\b(finance|financeiro|payment|pagamento|charge|cobranca)\b/i;
const STOCK_RE = /\b(stock|estoque|inventory)\b/i;

export function guardWorkflowRequest(
  workflowId: string,
  payload: Record<string, unknown>,
): WorkflowGuardResult {
  if (!(WORKFLOWS as readonly string[]).includes(workflowId)) {
    return {
      ok: false,
      code: "workflow_not_allowed",
      message: `Workflow "${workflowId}" fora da allow-list.`,
    };
  }
  if (DESTRUCTIVE_RE.test(workflowId)) {
    return { ok: false, code: "destructive_blocked", message: "Workflow destrutivo proibido." };
  }
  if (FINANCIAL_RE.test(workflowId)) {
    return { ok: false, code: "financial_blocked", message: "Workflow financeiro proibido." };
  }
  if (STOCK_RE.test(workflowId)) {
    return { ok: false, code: "stock_blocked", message: "Workflow de estoque proibido." };
  }
  const cats = payload.categoryIds;
  if (Array.isArray(cats) && cats.length > 1) {
    return {
      ok: false,
      code: "batch_blocked",
      message: "Nesta fase, um workflow atua em UMA categoria por vez.",
    };
  }
  return { ok: true };
}

export function guardWorkflowConfirmation(
  workflowId: WorkflowId,
  confirmed: boolean,
): WorkflowGuardResult {
  if (!confirmed) {
    return {
      ok: false,
      code: "confirmation_missing",
      message: `Workflow "${workflowId}" exige confirmação humana explícita.`,
    };
  }
  return { ok: true };
}

export function guardWorkflowTenant(
  proposal: WorkflowProposal,
  sessionCompanyId: string,
): WorkflowGuardResult {
  if (proposal.companyId !== sessionCompanyId) {
    return {
      ok: false,
      code: "tenant_mismatch",
      message: "Troca de empresa entre discovery e execução bloqueada.",
    };
  }
  return { ok: true };
}
