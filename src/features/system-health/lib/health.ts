/** Resultado de public.system_health_checks: uma linha por problema. */
export type HealthSeverity = "critical" | "warning" | "info";

export interface HealthIssue {
  code: string;
  severity: HealthSeverity;
  title: string;
  detail: string;
  ref_type: "product" | "sale" | "purchase" | "customer" | "account" | "integration" | "page" | string;
  ref_id: string | null;
  ref_label: string | null;
}

export const SEVERITY_ORDER: Record<HealthSeverity, number> = { critical: 0, warning: 1, info: 2 };

export const SEVERITY_LABEL: Record<HealthSeverity, string> = {
  critical: "Precisa corrigir",
  warning: "Conferir",
  info: "Para saber",
};

/** Agrupa por gravidade, mais grave primeiro. */
export function groupBySeverity(issues: HealthIssue[]) {
  const sorted = [...issues].sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) ||
      a.title.localeCompare(b.title),
  );
  const groups: { severity: HealthSeverity; items: HealthIssue[] }[] = [];
  for (const it of sorted) {
    const g = groups.find((x) => x.severity === it.severity);
    if (g) g.items.push(it);
    else groups.push({ severity: it.severity, items: [it] });
  }
  return groups;
}

/** Quantos problemas pedem ação (crítico + conferir). */
export function actionableCount(issues: HealthIssue[]) {
  return issues.filter((i) => i.severity !== "info").length;
}

/** Para onde o "Abrir" leva. */
export function issueLink(issue: HealthIssue): string | null {
  const id = issue.ref_id;
  switch (issue.ref_type) {
    case "product":
      return id ? `/produtos/${id}` : null;
    case "sale":
      return id ? `/vendas/${id}` : null;
    case "purchase":
      return id ? `/compras/${id}` : null;
    case "customer":
      return id ? `/clientes/${id}` : null;
    case "account":
      return "/financeiro?conciliar=1";
    case "integration":
      return "/saude-plataforma";
    case "page":
      return issue.ref_label && issue.ref_label.startsWith("/") ? issue.ref_label : null;
    default:
      return null;
  }
}
