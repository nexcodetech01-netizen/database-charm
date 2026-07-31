/**
 * FlowSimulator — executa o fluxo em modo "dry-run".
 *
 * NUNCA chama Skills, Services ou o Workflow Engine real. Apenas
 * percorre a lista de nós, estimando tempo e apontando o caminho
 * previsto para o usuário.
 */
import { BellaSkillRegistry } from "../skills/registry";
import { validateFlow } from "./FlowValidator";
import type {
  FlowDefinition,
  FlowSimulationResult,
  FlowSimulationStep,
} from "./types";

const DEFAULT_TIMING: Record<string, number> = {
  start: 0,
  end: 0,
  event: 50,
  condition: 30,
  if: 20,
  else: 20,
  loop: 100,
  delay: 0,
  webhook: 400,
  whatsapp: 300,
  skill: 500,
  workflow: 800,
  automation: 250,
  approval: 0,
  decision: 30,
  humanTask: 0,
  question: 0,
  confirmation: 0,
  notification: 80,
};

export function simulateFlow(
  flow: FlowDefinition,
  deps: { skills?: typeof BellaSkillRegistry } = {},
): FlowSimulationResult {
  const skills = deps.skills ?? BellaSkillRegistry;
  const validation = validateFlow(flow);
  const warnings: string[] = validation.issues.map((i) => i.message);
  const steps: FlowSimulationStep[] = [];
  let total = 0;

  for (const node of flow.nodes) {
    const base = DEFAULT_TIMING[node.kind] ?? 100;
    let ms = base;
    let action = describe(node.kind);
    let skillId: string | undefined;
    let note: string | undefined;

    if (node.kind === "delay") {
      ms = Number(node.config.ms ?? 0);
      action = `Aguardar ${ms}ms`;
    }
    if (node.kind === "skill") {
      skillId = String(node.config.skillId ?? "");
      const skill = skillId ? skills.get(skillId) : undefined;
      action = skill ? `Executar Skill "${skill.name}"` : `Skill "${skillId}" inexistente`;
      if (!skill) note = "Simulação não chamou Skill; publicação falhará.";
    }
    if (node.kind === "workflow") {
      const wfId = String(node.config.workflowId ?? "");
      action = `Delegar ao Workflow "${wfId}"`;
    }

    total += ms;
    steps.push({
      nodeId: node.id,
      kind: node.kind,
      label: node.label,
      action,
      estimatedMs: ms,
      skillId,
      note,
    });
  }

  return {
    flowId: flow.id,
    ok: validation.ok,
    steps,
    totalEstimatedMs: total,
    warnings,
  };
}

function describe(kind: string): string {
  const map: Record<string, string> = {
    start: "Início do fluxo",
    end: "Fim do fluxo",
    event: "Aguardar evento",
    condition: "Avaliar condição",
    if: "Ramo verdadeiro",
    else: "Ramo falso",
    loop: "Iterar coleção",
    delay: "Aguardar",
    webhook: "Chamar webhook",
    whatsapp: "Enviar WhatsApp (simulado)",
    skill: "Executar Skill",
    workflow: "Delegar a workflow",
    automation: "Disparar automação",
    approval: "Solicitar aprovação",
    decision: "Decisão do usuário",
    humanTask: "Tarefa humana",
    question: "Fazer pergunta",
    confirmation: "Pedir confirmação",
    notification: "Notificar usuário",
  };
  return map[kind] ?? kind;
}
