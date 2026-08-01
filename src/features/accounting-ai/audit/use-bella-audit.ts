import { useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditProvider } from "./provider";
import { buildBellaAuditInsights } from "./insights";
import { buildBellaAuditNotifications } from "./notifications";
import { auditHeadline, auditMetrics } from "./selectors";
import { auditLinks } from "./links";
import type { AuditRuleId, AuditSnapshot, AuditView } from "./types";
import type { ProviderResult } from "../types";

/**
 * Auditoria da Bella. Somente leitura: providers → motores oficiais.
 * O estado anterior fica apenas em memória (sessão) para narrar
 * "nova", "resolvida" e "recorrente".
 */
export interface UseBellaAuditOptions {
  /** Retrato já lido pelo dashboard (BellaContext) — evita o waterfall. */
  preloaded?: ProviderResult<AuditSnapshot> | null;
  loading?: boolean;
}

export function useBellaAudit(
  companyId: string | undefined,
  options: UseBellaAuditOptions = {},
) {
  const previousRef = useRef<AuditRuleId[]>([]);
  const seenRef = useRef<Set<AuditRuleId>>(new Set());

  const query = useQuery({
    queryKey: ["bella-audit", companyId],
    enabled: Boolean(companyId) && options.preloaded === undefined,
    staleTime: 60_000,
    queryFn: () => auditProvider(companyId as string),
  });

  const view = useMemo<AuditView>(() => {
    const result = options.preloaded !== undefined ? options.preloaded : query.data;
    const snapshot = result?.data ?? null;
    const notifications = buildBellaAuditNotifications(snapshot, {
      previous: { openIds: previousRef.current, seenIds: [...seenRef.current] },
    });
    if (snapshot) {
      previousRef.current = snapshot.findings.map((f) => f.id);
      snapshot.findings.forEach((f) => seenRef.current.add(f.id));
    }
    return {
      available: Boolean(result?.available && snapshot),
      note: result?.note,
      snapshot,
      headline: auditHeadline(snapshot),
      metrics: auditMetrics(snapshot),
      findings: snapshot?.findings ?? [],
      insights: buildBellaAuditInsights(snapshot),
      notifications,
      links: auditLinks(),
    };
  }, [query.data, options.preloaded]);

  return {
    view,
    isLoading: options.preloaded !== undefined ? Boolean(options.loading) : query.isLoading,
    refetch: query.refetch,
  };
}
