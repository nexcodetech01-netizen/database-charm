/**
 * Action Result Formatter — traduz `ActionProposal` / `ActionExecutionResult`
 * em `AIResponse.v1` para exibição no chat da Bella (sem calcular nada).
 */
import { RESPONSE_VERSION, type AIResponse } from "../contracts";
import type {
  ActionExecutionResult,
  ActionProposal,
} from "../actions/contracts";

export function formatActionProposal(
  proposal: ActionProposal,
  traceId: string,
): AIResponse {
  const impactLine = proposal.impact
    .map((i) => `${i.label}: ${i.value}`)
    .join(" • ");
  return {
    version: RESPONSE_VERSION,
    summary: `${proposal.title} — ${proposal.summary}${impactLine ? " " + impactLine : ""}`,
    confidence: "high",
    sources: [
      {
        kind: "usecase",
        useCase: `action:${proposal.actionId}`,
        toolCall: proposal.proposalId,
        traceId,
      },
    ],
    actions: [
      {
        id: `${proposal.proposalId}:cancel`,
        label: "Cancelar",
        intent: `action.cancel`,
        payload: { proposalId: proposal.proposalId },
        requiresApproval: false,
        scopes: [],
      },
      {
        id: `${proposal.proposalId}:confirm`,
        label: "Confirmar",
        intent: `action.${proposal.actionId}`,
        payload: { proposalId: proposal.proposalId },
        requiresApproval: true,
        scopes: [...proposal.scopes],
      },
    ],
    warnings: proposal.risks.map((r) => ({
      code: "guardrail_triggered",
      message: r.message,
    })),
    suggestedQuestions: [],
    traceId,
  };
}

export function formatActionResult(
  proposal: ActionProposal,
  result: ActionExecutionResult,
  traceId: string,
): AIResponse {
  if (result.status === "executed") {
    return {
      version: RESPONSE_VERSION,
      summary: `${proposal.title}: aplicada com sucesso (${result.executionTimeMs}ms).${
        result.alreadyAudited
          ? " Auditoria registrada pelo Use Case."
          : ""
      }`,
      confidence: "high",
      sources: [
        {
          kind: "usecase",
          useCase: result.useCase ?? `action:${proposal.actionId}`,
          toolCall: proposal.proposalId,
          traceId,
        },
      ],
      actions: [],
      warnings: [],
      suggestedQuestions: [],
      traceId,
    };
  }
  if (result.status === "cancelled") {
    return {
      version: RESPONSE_VERSION,
      summary: `${proposal.title}: cancelada. Nada foi alterado.`,
      confidence: "high",
      sources: [],
      actions: [],
      warnings: [],
      suggestedQuestions: [],
      traceId,
    };
  }
  return {
    version: RESPONSE_VERSION,
    summary: `${proposal.title}: falhou. Nada foi alterado.`,
    confidence: "low",
    sources: [],
    actions: [],
    warnings: [
      {
        code: "tool_error",
        message: result.error ?? "erro desconhecido",
      },
    ],
    suggestedQuestions: [],
    traceId,
  };
}
