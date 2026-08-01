/**
 * Bella Contadora — Auditoria: insights determinísticos.
 * Reutiliza o contrato oficial `AccountingInsight` (nenhuma regra nova).
 */
import type { AccountingInsight, InsightCategory, InsightSeverity } from "../insights";
import type { AuditCategory, AuditSeverity, AuditSnapshot } from "./types";

const SEVERITY: Record<AuditSeverity, InsightSeverity> = {
  critical: "critical",
  high: "warning",
  medium: "warning",
  low: "info",
};

const PRIORITY: Record<AuditSeverity, number> = {
  critical: 95,
  high: 80,
  medium: 60,
  low: 40,
};

const CATEGORY: Record<AuditCategory, InsightCategory> = {
  financeiro: "financeiro",
  caixa: "caixa",
  estoque: "estoque",
  comercial: "clientes",
  cadastros: "produtos",
  fiscal: "fiscal",
  tributario: "fiscal",
  contabil: "lucro",
};

export function buildBellaAuditInsights(
  snapshot: AuditSnapshot | null,
  limit = 6,
): AccountingInsight[] {
  if (!snapshot) return [];
  const createdAt = snapshot.generatedAt;

  if (snapshot.findings.length === 0) {
    return [
      {
        id: "auditoria_sem_inconsistencias",
        severity: "success",
        category: "financeiro",
        title: "Auditoria sem inconsistências",
        description: `As ${snapshot.counts.total} verificações da Bella passaram sem apontamentos.`,
        recommendation: "Mantenha a rotina de conferência diária.",
        priority: 20,
        action: { id: "manter_ritmo", label: "Manter o ritmo" },
        sourceProvider: "health",
        createdAt,
      },
    ];
  }

  return snapshot.findings.slice(0, limit).map((f) => ({
    id: `auditoria_${f.id}`,
    severity: SEVERITY[f.severity],
    category: CATEGORY[f.category],
    title: f.title,
    description: `${f.description} ${f.count} registro(s) afetado(s).`.trim(),
    recommendation: f.recommendation,
    priority: PRIORITY[f.severity],
    action: { id: "acompanhar", label: "Acompanhar" },
    sourceProvider: "health",
    createdAt,
  }));
}
