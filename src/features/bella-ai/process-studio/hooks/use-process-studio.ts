/**
 * Hooks React para o Process Studio.
 * Usa o singleton in-memory — mesmo padrão dos demais Registries Bella.
 */
import { useCallback, useSyncExternalStore } from "react";
import { ProcessStudio } from "../ProcessStudio";
import { FLOW_TEMPLATES, getTemplate } from "../FlowTemplates";
import type { FlowDefinition, FlowNode } from "../types";

// Store simples baseado em um contador de versão global do módulo.
let tick = 0;
const listeners = new Set<() => void>();
function bump() {
  tick += 1;
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot() {
  return tick;
}

export function useProcessStudioFlows(companyId: string): FlowDefinition[] {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return ProcessStudio.list(companyId);
}

export function useProcessStudioStats(companyId: string) {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return ProcessStudio.stats(companyId);
}

export function useProcessStudioActions(companyId: string, actorId: string | null) {
  const create = useCallback(
    (name: string, description?: string) => {
      const f = ProcessStudio.create({ companyId, name, description, authorId: actorId });
      bump();
      return f;
    },
    [companyId, actorId],
  );

  const createFromTemplate = useCallback(
    (key: string) => {
      const tpl = getTemplate(key);
      if (!tpl) throw new Error(`Template ${key} não encontrado.`);
      const built = tpl.build(companyId, actorId);
      const f = ProcessStudio.create({
        companyId,
        name: built.name,
        description: built.description,
        authorId: actorId,
        nodes: built.nodes,
        tags: built.tags,
      });
      bump();
      return f;
    },
    [companyId, actorId],
  );

  const update = useCallback(
    (
      flowId: string,
      patch: { name?: string; description?: string; nodes?: readonly FlowNode[] },
    ) => {
      const f = ProcessStudio.update(companyId, flowId, { ...patch, actorId });
      bump();
      return f;
    },
    [companyId, actorId],
  );

  const validate = useCallback(
    (flowId: string) => ProcessStudio.validate(companyId, flowId),
    [companyId],
  );
  const simulate = useCallback(
    (flowId: string) => ProcessStudio.simulate(companyId, flowId),
    [companyId],
  );
  const publish = useCallback(
    (flowId: string) => {
      const res = ProcessStudio.publish(companyId, flowId, actorId);
      bump();
      return res;
    },
    [companyId, actorId],
  );
  const archive = useCallback(
    (flowId: string) => {
      const f = ProcessStudio.archive(companyId, flowId, actorId);
      bump();
      return f;
    },
    [companyId, actorId],
  );
  const rollback = useCallback(
    (flowId: string, targetVersion: number) => {
      const f = ProcessStudio.rollback(companyId, flowId, targetVersion, actorId);
      bump();
      return f;
    },
    [companyId, actorId],
  );
  const listVersions = useCallback(
    (flowId: string) => ProcessStudio.listVersions(companyId, flowId),
    [companyId],
  );
  const listLogs = useCallback(
    (flowId?: string) => ProcessStudio.listLogs(companyId, flowId),
    [companyId],
  );

  return {
    create,
    createFromTemplate,
    update,
    validate,
    simulate,
    publish,
    archive,
    rollback,
    listVersions,
    listLogs,
    templates: FLOW_TEMPLATES,
  };
}
