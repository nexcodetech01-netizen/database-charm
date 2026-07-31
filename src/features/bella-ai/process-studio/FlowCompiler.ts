/**
 * FlowCompiler — traduz um FlowDefinition para uma
 * `BellaWorkflowDefinition` executável pelo BellaWorkflowEngine.
 *
 * Estratégia:
 *   - Só nós `skill` viram Steps executáveis (única forma de efeito real).
 *   - Nós de controle (condition/if/else/loop/delay/notification/…) viram
 *     metadados anexados ao próximo Skill ou descritos no simulador.
 *   - Nós `workflow` viram Steps que delegam a um Workflow registrado
 *     através de uma Skill "meta" opcional (não implementada aqui — só é
 *     compilado se a Skill correspondente existir; caso contrário fica
 *     apenas na simulação).
 *
 * Consequência: publicar um Flow gera uma `BellaWorkflowDefinition`
 * consumida pelo engine existente. Zero motor paralelo.
 */
import type {
  BellaWorkflowDefinition,
  BellaWorkflowStep,
} from "../workflows/BellaWorkflowTypes";
import type { BellaSkillPayload } from "../skills/types";
import type { FlowDefinition, FlowNode } from "./types";

export interface CompileResult {
  readonly definition: BellaWorkflowDefinition;
  readonly skippedNodes: readonly string[];
}

function skillStep(node: FlowNode, index: number): BellaWorkflowStep {
  const skillId = String(node.config.skillId ?? "");
  const staticPayload = (node.config.payload ?? {}) as BellaSkillPayload;
  return {
    id: `${node.id}_${index}`,
    name: node.label || `Passo ${index + 1}`,
    description: (node.config.description as string) ?? undefined,
    skillId,
    requiresConfirmation: Boolean(node.config.requiresConfirmation),
    buildPayload({ collectedParameters, previousOutputs }) {
      // Puro: combina parâmetros coletados + saídas anteriores + payload
      // estático declarado no nó. Não acessa Services.
      return {
        ...collectedParameters,
        ...previousOutputs,
        ...staticPayload,
      } as BellaSkillPayload;
    },
    extractOutputs(result) {
      const data = (result as { data?: unknown }).data;
      if (data && typeof data === "object") {
        return data as Record<string, unknown>;
      }
      return {};
    },
  };
}

export function compileFlow(flow: FlowDefinition): CompileResult {
  const steps: BellaWorkflowStep[] = [];
  const skipped: string[] = [];

  flow.nodes.forEach((node, i) => {
    if (node.kind === "skill" && String(node.config.skillId ?? "")) {
      steps.push(skillStep(node, i));
    } else if (node.kind === "start" || node.kind === "end") {
      // Marcadores estruturais — não geram Step.
    } else {
      // Nós de controle não têm efeito real — anotados só para o simulador.
      skipped.push(node.id);
    }
  });

  const definition: BellaWorkflowDefinition = Object.freeze({
    workflowId: `flow::${flow.id}::v${flow.version}`,
    name: flow.name,
    description: flow.description,
    steps,
  });

  return { definition, skippedNodes: skipped };
}
