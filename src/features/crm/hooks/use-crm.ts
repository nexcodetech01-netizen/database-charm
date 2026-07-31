import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { crmService } from "../services/crm.service";
import type { OpportunityInsert, OpportunityUpdate, PipelineStageInsert } from "../types";

export const crmKeys = {
  all: ["crm"] as const,
  stages: (companyId: string) => ["crm", "stages", companyId] as const,
  opportunities: (companyId: string, filters?: unknown) =>
    ["crm", "opportunities", companyId, filters] as const,
  opportunity: (id: string) => ["crm", "opportunity", id] as const,
  metrics: (companyId: string) => ["crm", "metrics", companyId] as const,
  events: (companyId: string, filters?: unknown) => ["crm", "events", companyId, filters] as const,
};

export function usePipelineStages(companyId: string) {
  return useQuery({
    queryKey: crmKeys.stages(companyId),
    queryFn: () => crmService.ensureDefaultStages(companyId),
    enabled: !!companyId,
  });
}

export function useOpportunities(
  companyId: string,
  filters?: { search?: string; stageId?: string; status?: string },
) {
  return useQuery({
    queryKey: crmKeys.opportunities(companyId, filters),
    queryFn: () => crmService.listOpportunities(companyId, filters),
    enabled: !!companyId,
  });
}

export function useCrmMetrics(companyId: string) {
  return useQuery({
    queryKey: crmKeys.metrics(companyId),
    queryFn: () => crmService.metrics(companyId),
    enabled: !!companyId,
  });
}

export function useCrmEvents(
  companyId: string,
  filters?: { customerId?: string; opportunityId?: string; limit?: number },
) {
  return useQuery({
    queryKey: crmKeys.events(companyId, filters),
    queryFn: () => crmService.listEvents(companyId, filters),
    enabled: !!companyId,
  });
}

export function useCreateOpportunity(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: OpportunityInsert) => crmService.createOpportunity(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm", "opportunities", companyId] });
      qc.invalidateQueries({ queryKey: crmKeys.metrics(companyId) });
    },
  });
}

export function useUpdateOpportunity(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: OpportunityUpdate }) =>
      crmService.updateOpportunity(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm", "opportunities", companyId] });
      qc.invalidateQueries({ queryKey: crmKeys.metrics(companyId) });
    },
  });
}

export function useMoveOpportunity(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stageId, position }: { id: string; stageId: string; position: number }) =>
      crmService.moveOpportunity(id, stageId, position),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm", "opportunities", companyId] });
      qc.invalidateQueries({ queryKey: crmKeys.metrics(companyId) });
    },
  });
}

export function useCloseOpportunity(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: "won" | "lost"; reason?: string }) =>
      crmService.closeOpportunity(id, status, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm", "opportunities", companyId] });
      qc.invalidateQueries({ queryKey: crmKeys.metrics(companyId) });
    },
  });
}

export function useDeleteOpportunity(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => crmService.deleteOpportunity(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm", "opportunities", companyId] });
      qc.invalidateQueries({ queryKey: crmKeys.metrics(companyId) });
    },
  });
}

export function useCreateStage(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PipelineStageInsert) => crmService.createStage(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: crmKeys.stages(companyId) }),
  });
}

export function useAddCrmNote(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note: { customer_id?: string | null; opportunity_id?: string | null; description: string; user_id?: string | null }) =>
      crmService.addNote(companyId, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "events", companyId] }),
  });
}
