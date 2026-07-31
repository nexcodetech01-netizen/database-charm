/**
 * useSalesCopilotMetrics — expõe métricas agregadas do SalesCopilot
 * (leitura pura). Não persiste; reset ao recarregar o processo.
 */

import { useCallback, useState } from "react";
import { salesCopilot } from "../SalesCopilot";
import type { SalesCopilotMetrics } from "../types";

export interface SalesCopilotDerivedMetrics extends SalesCopilotMetrics {
  conversionRate: number;
  avgDurationMs: number;
  abandonRate: number;
}

function derive(m: SalesCopilotMetrics): SalesCopilotDerivedMetrics {
  const total = m.started || 0;
  const conversionRate = total > 0 ? m.completed / total : 0;
  const abandonRate = total > 0 ? m.cancelled / total : 0;
  const closed = m.completed + m.cancelled;
  const avgDurationMs = closed > 0 ? Math.round(m.totalDurationMs / closed) : 0;
  return { ...m, conversionRate, avgDurationMs, abandonRate };
}

export function useSalesCopilotMetrics() {
  const [metrics, setMetrics] = useState<SalesCopilotDerivedMetrics>(() =>
    derive(salesCopilot.getMetrics()),
  );
  const refresh = useCallback(() => {
    setMetrics(derive(salesCopilot.getMetrics()));
  }, []);
  return { metrics, refresh };
}
