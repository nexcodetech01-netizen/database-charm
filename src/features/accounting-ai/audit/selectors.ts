/**
 * Bella Contadora — Auditoria: seletores de leitura (puros).
 * Só formatam o que o provider já apurou.
 */
import { AUDIT_CATEGORY_LABELS } from "./rules";
import type { AuditFinding, AuditMetric, AuditSeverity, AuditSnapshot } from "./types";

export const AUDIT_SEVERITY_LABELS: Record<AuditSeverity, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
  low: "Baixo",
};

export function auditHeadline(snapshot: AuditSnapshot | null): string {
  if (!snapshot) return "Auditoria indisponível no momento.";
  const { counts } = snapshot;
  if (counts.critical + counts.high + counts.medium + counts.low === 0) {
    return `Nenhuma inconsistência encontrada em ${counts.total} verificações.`;
  }
  return `${counts.critical} crítico(s), ${counts.high} alto(s), ${counts.medium} médio(s) e ${counts.low} baixo(s) em ${counts.total} verificações.`;
}

export function auditMetrics(snapshot: AuditSnapshot | null): AuditMetric[] {
  if (!snapshot) return [];
  const { counts, health } = snapshot;
  return [
    {
      id: "critico",
      label: "Crítico",
      value: String(counts.critical),
      emphasis: counts.critical > 0,
    },
    { id: "alto", label: "Alto", value: String(counts.high) },
    { id: "medio", label: "Médio", value: String(counts.medium) },
    { id: "baixo", label: "Baixo", value: String(counts.low) },
    {
      id: "ok",
      label: "OK",
      value: String(counts.ok),
      hint: `${counts.total} verificações`,
    },
    {
      id: "score",
      label: "Saúde operacional",
      value: `${health.score}%`,
      hint: health.label,
    },
  ];
}

/** Texto determinístico da auditoria (usado pelo chat). */
export function describeAudit(snapshot: AuditSnapshot | null, limit = 5): string {
  if (!snapshot) return "Não consegui ler os dados para auditar agora.";
  const { counts } = snapshot;
  const header = `Hoje encontrei: 🔴 ${counts.critical} problema(s) crítico(s), 🟡 ${counts.high + counts.medium + counts.low} alerta(s) e 🟢 ${counts.ok} verificação(ões) sem inconsistências.`;
  if (snapshot.findings.length === 0) return `${header} Nada exige a sua atenção agora.`;
  const details = snapshot.findings
    .slice(0, limit)
    .map((f) => `• ${f.title} (${AUDIT_CATEGORY_LABELS[f.category]}): ${f.count} registro(s).`)
    .join(" ");
  return `${header} Detalhamento: ${details}`;
}

/** Lista textual das inconsistências (sem o cabeçalho de contagem). */
export function describeFindings(snapshot: AuditSnapshot | null, limit = 8): string {
  if (!snapshot) return "Não consegui ler os dados para auditar agora.";
  if (snapshot.findings.length === 0) return "Não encontrei inconsistências nos seus dados.";
  return snapshot.findings
    .slice(0, limit)
    .map(
      (f) =>
        `${AUDIT_SEVERITY_LABELS[f.severity]} · ${f.title} — ${f.count} registro(s). ${f.recommendation}`,
    )
    .join(" ");
}

export function describeOperationalHealth(snapshot: AuditSnapshot | null): string {
  if (!snapshot) return "Saúde operacional indisponível.";
  const worst = snapshot.categories
    .filter((c) => c.findings > 0)
    .sort((a, b) => b.critical - a.critical || b.findings - a.findings)[0];
  const base = `Saúde operacional: ${snapshot.health.label} (${snapshot.health.score}%).`;
  return worst ? `${base} Área mais afetada: ${worst.label} (${worst.findings}).` : base;
}

export function findingsByCategory(snapshot: AuditSnapshot | null): AuditFinding[] {
  return snapshot?.findings ?? [];
}
