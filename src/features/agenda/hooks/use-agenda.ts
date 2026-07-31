import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { agendaService } from "../services/agenda.service";
import type { AppointmentFilters, AppointmentInsert, AppointmentUpdate } from "../types";

export const agendaKeys = {
  all: ["agenda"] as const,
  list: (companyId: string, filters: AppointmentFilters) =>
    ["agenda", "list", companyId, filters] as const,
  metrics: (companyId: string) => ["agenda", "metrics", companyId] as const,
  detail: (id: string) => ["agenda", "detail", id] as const,
  events: (id: string) => ["agenda", "events", id] as const,
};

export function useAppointmentsRange(companyId: string, filters: AppointmentFilters) {
  return useQuery({
    queryKey: agendaKeys.list(companyId, filters),
    queryFn: () => agendaService.listRange(companyId, filters),
    enabled: !!companyId,
  });
}

export function useAgendaMetrics(companyId: string) {
  return useQuery({
    queryKey: agendaKeys.metrics(companyId),
    queryFn: () => agendaService.metrics(companyId),
    enabled: !!companyId,
  });
}

export function useAppointment(id: string | undefined) {
  return useQuery({
    queryKey: agendaKeys.detail(id ?? ""),
    queryFn: () => agendaService.get(id as string),
    enabled: !!id,
  });
}

export function useAppointmentEvents(id: string | undefined) {
  return useQuery({
    queryKey: agendaKeys.events(id ?? ""),
    queryFn: () => agendaService.listEvents(id as string),
    enabled: !!id,
  });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AppointmentInsert) => agendaService.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: agendaKeys.all }),
  });
}

export function useUpdateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AppointmentUpdate }) =>
      agendaService.update(id, input),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: agendaKeys.all });
      qc.invalidateQueries({ queryKey: agendaKeys.events(vars.id) });
    },
  });
}

export function useDeleteAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => agendaService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: agendaKeys.all }),
  });
}
