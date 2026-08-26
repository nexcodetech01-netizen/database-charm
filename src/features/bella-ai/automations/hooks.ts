/**
 * React Query hooks para o módulo Automations.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createAutomationFromTemplate,
  deleteAutomation,
  listAutomationRuns,
  listAutomations,
  listAutomationTemplates,
  runAutomationTest,
  setAutomationEnabled,
} from "./service.functions";
import type { Automation, AutomationRun } from "./types";
import type { AutomationTemplate } from "./templates";

const KEY = {
  list: (companyId: string) => ["bella-automations", "list", companyId] as const,
  runs: (companyId: string, automationId?: string | null) =>
    ["bella-automations", "runs", companyId, automationId ?? "all"] as const,
  templates: () => ["bella-automations", "templates"] as const,
};

export function useAutomations(companyId: string | null) {
  const fn = useServerFn(listAutomations);
  return useQuery<Automation[]>({
    queryKey: KEY.list(companyId ?? "none"),
    queryFn: () => fn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
    staleTime: 15_000,
  });
}

export function useAutomationRuns(companyId: string | null, automationId?: string | null) {
  const fn = useServerFn(listAutomationRuns);
  return useQuery<AutomationRun[]>({
    queryKey: KEY.runs(companyId ?? "none", automationId ?? null),
    queryFn: () =>
      fn({ data: { companyId: companyId!, automationId: automationId ?? undefined, limit: 100 } }),
    enabled: !!companyId,
    staleTime: 60_000,
    // Egress: polling espaçado e apenas com a aba em foco.
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
  });
}

export function useAutomationTemplates() {
  const fn = useServerFn(listAutomationTemplates);
  return useQuery<AutomationTemplate[]>({
    queryKey: KEY.templates(),
    queryFn: () => fn(),
    staleTime: Infinity,
  });
}

export function useCreateAutomationFromTemplate(companyId: string | null) {
  const qc = useQueryClient();
  const fn = useServerFn(createAutomationFromTemplate);
  return useMutation({
    mutationFn: (templateId: string) =>
      fn({ data: { companyId: companyId!, templateId } }),
    onSuccess: () => {
      if (companyId) qc.invalidateQueries({ queryKey: KEY.list(companyId) });
    },
  });
}

export function useToggleAutomation(companyId: string | null) {
  const qc = useQueryClient();
  const fn = useServerFn(setAutomationEnabled);
  return useMutation({
    mutationFn: (input: { id: string; enabled: boolean }) => fn({ data: input }),
    onSuccess: () => {
      if (companyId) qc.invalidateQueries({ queryKey: KEY.list(companyId) });
    },
  });
}

export function useDeleteAutomation(companyId: string | null) {
  const qc = useQueryClient();
  const fn = useServerFn(deleteAutomation);
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => {
      if (companyId) qc.invalidateQueries({ queryKey: KEY.list(companyId) });
    },
  });
}

export function useRunAutomationTest(companyId: string | null) {
  const qc = useQueryClient();
  const fn = useServerFn(runAutomationTest);
  return useMutation({
    mutationFn: (input: { automationId: string; payload?: Record<string, unknown> }) =>
      fn({
        data: {
          automationId: input.automationId,
          companyId: companyId!,
          payload: input.payload ?? {},
        },
      }),
    onSuccess: () => {
      if (companyId) {
        qc.invalidateQueries({ queryKey: KEY.runs(companyId) });
        qc.invalidateQueries({ queryKey: KEY.list(companyId) });
      }
    },
  });
}
