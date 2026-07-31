/**
 * SAFE ACTION Guardrails (§9 desta sprint) — validações determinísticas
 * aplicadas ANTES de qualquer execução, seja proposal ou confirm.
 *
 * BLOQUEIA:
 *   - Actions fora da allow-list SAFE_ACTIONS.
 *   - Payloads em lote (arrays de ids).
 *   - Verbos destrutivos ("delete", "remove", "cancel", "refund").
 *   - Alterações financeiras (finance, payment, refund, chargeback).
 *   - Confirmação sem `confirmed=true` explícito.
 */
import { SAFE_ACTIONS, type SafeActionId } from "./contracts";

export interface ActionGuardResult {
  readonly ok: boolean;
  readonly code?:
    | "action_not_allowed"
    | "batch_blocked"
    | "destructive_blocked"
    | "financial_blocked"
    | "confirmation_missing";
  readonly message?: string;
}

const DESTRUCTIVE_RE =
  /\b(delete|remove|apagar|excluir|cancelar|estorno|refund|chargeback)\b/i;
const FINANCIAL_RE =
  /\b(finance|financeiro|payment|pagamento|charge|cobranca|refund|estorno)\b/i;

function isBatchPayload(payload: Record<string, unknown>): boolean {
  for (const value of Object.values(payload)) {
    if (Array.isArray(value) && value.length > 1) return true;
  }
  return false;
}

/** Guard aplicada antes de `buildProposal`. */
export function guardActionRequest(
  actionId: string,
  payload: Record<string, unknown>,
): ActionGuardResult {
  if (!(SAFE_ACTIONS as readonly string[]).includes(actionId)) {
    return {
      ok: false,
      code: "action_not_allowed",
      message: `Action "${actionId}" não está na allow-list SAFE_ACTIONS.`,
    };
  }
  if (DESTRUCTIVE_RE.test(actionId)) {
    return {
      ok: false,
      code: "destructive_blocked",
      message: "Actions destrutivas são proibidas nesta fase.",
    };
  }
  if (FINANCIAL_RE.test(actionId)) {
    return {
      ok: false,
      code: "financial_blocked",
      message:
        "Alterações financeiras (pagamentos, estornos) são proibidas nesta fase.",
    };
  }
  if (isBatchPayload(payload)) {
    return {
      ok: false,
      code: "batch_blocked",
      message: "Aplicação em lote é proibida nesta fase.",
    };
  }
  return { ok: true };
}

/** Guard aplicada antes de `execute`. Exige `confirmed=true` explícito. */
export function guardActionConfirmation(
  actionId: SafeActionId,
  confirmed: boolean,
): ActionGuardResult {
  if (!confirmed) {
    return {
      ok: false,
      code: "confirmation_missing",
      message: `Action "${actionId}" exige confirmação humana explícita.`,
    };
  }
  return { ok: true };
}
