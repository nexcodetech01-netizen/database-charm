/**
 * FlowValidator — validação estrutural pura de um FlowDefinition.
 *
 * Regras:
 *   - Deve conter exatamente 1 `start` e ao menos 1 `end`.
 *   - IDs de nós únicos.
 *   - Nó `skill` deve referenciar `skillId` existente no BellaSkillRegistry.
 *   - Nó `workflow` deve referenciar `workflowId` no BellaWorkflowRegistry.
 *   - Nós de configuração (delay/notification/etc.) validam campos mínimos.
 */
// Imports dinâmicos são usados para evitar vazamento de código server-only para o bundle do cliente.

import type {
  FlowDefinition,
  FlowValidationIssue,
  FlowValidationResult,
} from "./types";

export function validateFlow(
  flow: FlowDefinition,
  deps: {
    skills?: { has(id: string): boolean };
    workflows?: { has(id: string): boolean };
  } = {},
): FlowValidationResult {
  const { skills, workflows } = deps;

  const issues: FlowValidationIssue[] = [];

  if (!flow.nodes || flow.nodes.length === 0) {
    issues.push({ code: "empty_flow", message: "Fluxo vazio." });
    return { ok: false, issues };
  }

  const starts = flow.nodes.filter((n) => n.kind === "start");
  const ends = flow.nodes.filter((n) => n.kind === "end");
  if (starts.length !== 1) {
    issues.push({
      code: "missing_start",
      message: "O fluxo deve conter exatamente 1 nó de Início.",
    });
  }
  if (ends.length === 0) {
    issues.push({
      code: "missing_end",
      message: "O fluxo deve conter ao menos 1 nó de Fim.",
    });
  }

  const seen = new Set<string>();
  for (const node of flow.nodes) {
    if (seen.has(node.id)) {
      issues.push({
        nodeId: node.id,
        code: "duplicate_id",
        message: `ID de nó duplicado: ${node.id}.`,
      });
    }
    seen.add(node.id);

    switch (node.kind) {
      case "skill": {
        const skillId = String(node.config.skillId ?? "");
        if (!skillId) {
          issues.push({
            nodeId: node.id,
            code: "invalid_config",
            message: `Nó "${node.label}" não informa skillId.`,
          });
        } else if (skills && !skills.has(skillId)) {
          issues.push({
            nodeId: node.id,
            code: "invalid_skill",
            message: `Skill "${skillId}" não está registrada.`,
          });
        }
        break;
      }
      case "workflow": {
        const wfId = String(node.config.workflowId ?? "");
        if (!wfId || (workflows && !workflows.has(wfId))) {
          issues.push({
            nodeId: node.id,
            code: "invalid_config",
            message: `Workflow "${wfId}" não está registrado.`,
          });
        }
        break;
      }
      case "delay": {
        const ms = Number(node.config.ms ?? 0);
        if (!Number.isFinite(ms) || ms < 0) {
          issues.push({
            nodeId: node.id,
            code: "invalid_config",
            message: `Delay inválido em "${node.label}".`,
          });
        }
        break;
      }
      case "notification":
      case "whatsapp":
      case "question":
      case "confirmation":
      case "approval":
      case "humanTask": {
        if (!String(node.config.message ?? node.config.prompt ?? "").trim()) {
          issues.push({
            nodeId: node.id,
            code: "invalid_config",
            message: `"${node.label}" precisa de mensagem/pergunta.`,
          });
        }
        break;
      }
      default:
        break;
    }
  }

  return { ok: issues.length === 0, issues };
}
