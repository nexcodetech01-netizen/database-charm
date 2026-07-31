import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cashService } from "../services/cash.service";
import type {
  CashSession,
  CloseSessionInput,
  OpenSessionInput,
  RegisterMovementInput,
} from "../types";

export const cashKeys = {
  all: ["cash"] as const,
  open: (companyId: string, operatorId: string) =>
    ["cash", "open", companyId, operatorId] as const,
  list: (companyId: string) => ["cash", "list", companyId] as const,
  summary: (sessionId: string) => ["cash", "summary", sessionId] as const,
  movements: (sessionId: string) => ["cash", "movements", sessionId] as const,
};

export function useOpenCashSession(companyId: string, operatorId: string) {
  return useQuery({
    queryKey: cashKeys.open(companyId, operatorId),
    queryFn: () => cashService.getOpenSession(companyId, operatorId),
    enabled: !!companyId && !!operatorId,
  });
}

export function useCashSessions(companyId: string) {
  return useQuery({
    queryKey: cashKeys.list(companyId),
    queryFn: () => cashService.listSessions(companyId),
    enabled: !!companyId,
  });
}

export function useCashSummary(
  session: CashSession | null | undefined,
  includeTest = false,
) {
  return useQuery({
    queryKey: [...cashKeys.summary(session?.id ?? ""), includeTest],
    queryFn: () => cashService.computeSummary(session!, { includeTest }),
    enabled: !!session,
    refetchInterval: session?.status === "open" ? 15000 : false,
  });
}

export function useOpenCash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: OpenSessionInput) => cashService.openSession(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: cashKeys.all }),
  });
}

export function useRegisterCashMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterMovementInput) => cashService.registerMovement(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: cashKeys.all }),
  });
}

export function useCloseCash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CloseSessionInput) => cashService.closeSession(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: cashKeys.all }),
  });
}
