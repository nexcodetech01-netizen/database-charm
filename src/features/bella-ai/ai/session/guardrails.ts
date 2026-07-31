/**
 * Guardrails da SessionMemory (AI-004).
 *
 * Regras invioláveis:
 *   1. Tenant isolation — contexto de empresa A nunca vaza para B.
 *   2. Ações executadas não podem ser re-executadas silenciosamente
 *      (ex.: usuário diz "aplica agora" após aplicação já concluída).
 *   3. Nova execução exige NOVA proposta + NOVA confirmação — este
 *      módulo só sinaliza; a execução em si é feita pelos executors
 *      de action/workflow que já exigem `confirmed=true`.
 */
import type { SessionContext } from "./contracts";

export type SessionGuardCode =
  | "ok"
  | "tenant_mismatch"
  | "action_already_executed"
  | "workflow_already_executed"
  | "no_action_in_context"
  | "no_workflow_in_context";

export interface SessionGuardResult {
  readonly ok: boolean;
  readonly code: SessionGuardCode;
  readonly message?: string;
}

const OK: SessionGuardResult = { ok: true, code: "ok" };

export function guardTenant(
  ctx: SessionContext,
  companyId: string,
): SessionGuardResult {
  if (ctx.companyId !== companyId) {
    return {
      ok: false,
      code: "tenant_mismatch",
      message: "Contexto pertence a outra empresa.",
    };
  }
  return OK;
}

export function guardActionReuse(ctx: SessionContext): SessionGuardResult {
  if (!ctx.lastAction) {
    return {
      ok: false,
      code: "no_action_in_context",
      message: "Nenhuma ação recente para confirmar.",
    };
  }
  if (ctx.lastAction.executed) {
    return {
      ok: false,
      code: "action_already_executed",
      message:
        "Essa ação já foi executada. Peça uma nova sugestão para aplicar novamente.",
    };
  }
  return OK;
}

export function guardWorkflowReuse(ctx: SessionContext): SessionGuardResult {
  if (!ctx.lastWorkflow) {
    return {
      ok: false,
      code: "no_workflow_in_context",
      message: "Nenhum workflow recente para confirmar.",
    };
  }
  if (ctx.lastWorkflow.executed) {
    return {
      ok: false,
      code: "workflow_already_executed",
      message:
        "Esse workflow já foi executado. Reabra a Central de Revisão para propor um novo.",
    };
  }
  return OK;
}
