import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getFiscalHealth,
  getFiscalHealthConfig,
  getFiscalHealthHistory,
  recordFiscalHealthSnapshot,
  updateFiscalHealthConfig,
  type FiscalHealthConfigDto,
} from "../functions/fiscal-health.functions";

const QK = {
  health: ["fiscal-health", "current"] as const,
  config: ["fiscal-health", "config"] as const,
  history: ["fiscal-health", "history"] as const,
};

export function useFiscalHealth() {
  const fn = useServerFn(getFiscalHealth);
  return useQuery({ queryKey: QK.health, queryFn: () => fn() });
}

export function useFiscalHealthConfig() {
  const fn = useServerFn(getFiscalHealthConfig);
  return useQuery({ queryKey: QK.config, queryFn: () => fn() });
}

export function useFiscalHealthHistory() {
  const fn = useServerFn(getFiscalHealthHistory);
  return useQuery({ queryKey: QK.history, queryFn: () => fn() });
}

export function useUpdateFiscalHealthConfig() {
  const qc = useQueryClient();
  const fn = useServerFn(updateFiscalHealthConfig);
  return useMutation({
    mutationFn: (data: FiscalHealthConfigDto) =>
      fn({
        data: {
          regime: data.regime,
          annualRevenueLimit: data.annualRevenueLimit,
          fiscalYearStartMonth: data.fiscalYearStartMonth,
          alertThresholds: data.alertThresholds,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.config });
      qc.invalidateQueries({ queryKey: QK.health });
    },
  });
}

export function useRecordFiscalHealthSnapshot() {
  const qc = useQueryClient();
  const fn = useServerFn(recordFiscalHealthSnapshot);
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.history }),
  });
}
