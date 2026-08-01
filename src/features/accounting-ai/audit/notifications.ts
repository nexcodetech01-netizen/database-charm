/**
 * Bella Contadora — Auditoria: notificações proativas.
 *
 * Compara o retrato atual com o retrato anterior (estado de sessão, em
 * memória) para narrar: nova inconsistência, problema resolvido, problema
 * recorrente e problema crítico. Nada é gravado em banco.
 */
import type { BellaNotification, NotificationCategory } from "../proactive";
import type { AuditCategory, AuditRuleId, AuditSnapshot } from "./types";

const CATEGORY: Record<AuditCategory, NotificationCategory> = {
  financeiro: "financeiro",
  caixa: "caixa",
  estoque: "estoque",
  comercial: "clientes",
  cadastros: "produtos",
  fiscal: "fiscal",
  tributario: "fiscal",
  contabil: "lucro",
};

/** Estado da auditoria anterior (sessão do navegador/teste). */
export interface AuditPreviousState {
  /** Inconsistências vistas na leitura anterior. */
  openIds: readonly AuditRuleId[];
  /** Inconsistências que já apareceram em leituras passadas. */
  seenIds?: readonly AuditRuleId[];
}

export interface AuditNotificationOptions {
  previous?: AuditPreviousState | null;
  limit?: number;
}

export function buildBellaAuditNotifications(
  snapshot: AuditSnapshot | null,
  options: AuditNotificationOptions = {},
): BellaNotification[] {
  if (!snapshot) return [];
  const previousOpen = new Set(options.previous?.openIds ?? []);
  const seen = new Set(options.previous?.seenIds ?? options.previous?.openIds ?? []);
  const createdAt = snapshot.generatedAt;
  const out: BellaNotification[] = [];

  for (const f of snapshot.findings) {
    const isNew = !previousOpen.has(f.id);
    const recurrent = !isNew || seen.has(f.id);
    const critical = f.severity === "critical";

    out.push({
      id: `auditoria_${f.id}`,
      category: CATEGORY[f.category],
      severity: critical ? "critical" : f.severity === "low" ? "info" : "warning",
      title: critical
        ? `Problema crítico: ${f.title}`
        : isNew
          ? `Nova inconsistência: ${f.title}`
          : recurrent
            ? `Problema recorrente: ${f.title}`
            : f.title,
      message: `${f.description} ${f.count} registro(s) afetado(s).`.trim(),
      recommendation: f.recommendation,
      action: { id: "conferir_dados", label: "Conferir dados" },
      priority: critical ? 98 : f.severity === "high" ? 82 : f.severity === "medium" ? 62 : 42,
      createdAt,
      dismissible: !critical,
      persistent: critical,
    });
  }

  const openNow = new Set(snapshot.findings.map((f) => f.id));
  for (const id of previousOpen) {
    if (openNow.has(id)) continue;
    const check = snapshot.checks.find((c) => c.id === id);
    if (!check) continue;
    out.push({
      id: `auditoria_resolvido_${id}`,
      category: CATEGORY[check.category],
      severity: "success",
      title: `Problema resolvido: ${check.label}`,
      message: "A inconsistência apontada anteriormente não aparece mais nos seus dados.",
      recommendation: "Mantenha a rotina que corrigiu esse ponto.",
      action: { id: "manter_ritmo", label: "Manter o ritmo" },
      priority: 25,
      createdAt,
      dismissible: true,
      persistent: false,
    });
  }

  return out
    .sort((a, b) => b.priority - a.priority)
    .slice(0, options.limit ?? 10);
}
