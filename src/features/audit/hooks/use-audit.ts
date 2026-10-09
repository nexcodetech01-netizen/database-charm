import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { auditService, type AuditListFilters } from "../services/audit.service";

export function useCanViewAudit(companyId: string | undefined) {
  return useQuery({
    queryKey: ["audit", "can-view", companyId],
    enabled: !!companyId,
    staleTime: 10 * 60_000,
    queryFn: () => auditService.canView(companyId!),
  });
}

export function useAuditList(filters: AuditListFilters, enabled = true) {
  return useQuery({
    queryKey: ["audit", "list", filters],
    enabled: enabled && !!filters.companyId,
    placeholderData: keepPreviousData,
    queryFn: () => auditService.list(filters),
  });
}

export function useRecordHistory(
  table: string,
  recordId: string | null | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: ["audit", "record", table, recordId],
    enabled: enabled && !!recordId,
    queryFn: () => auditService.forRecord(table, recordId!),
  });
}

export function useAuditActors(companyId: string, enabled = true) {
  return useQuery({
    queryKey: ["audit", "actors", companyId],
    enabled: enabled && !!companyId,
    staleTime: 5 * 60_000,
    queryFn: () => auditService.actors(companyId),
  });
}
