/**
 * Bella Contadora — Auditoria (Sprint 7.2): provider de leitura.
 *
 * Lê os motores oficiais através das portas e aplica as regras puras de
 * `rules.ts`. NENHUMA escrita, correção ou recálculo acontece aqui.
 */
import { accountingAiServices } from "../services/adapters";
import { currentPeriod, readSafely, todayISO } from "../lib/helpers";
import type { ProviderDeps } from "../providers";
import type { ProviderResult } from "../types";
import { taxRegimeProvider } from "../tax/provider";
import { AUDIT_CATEGORY_LABELS, AUDIT_RULES } from "./rules";
import type {
  AuditCategory,
  AuditCategoryScore,
  AuditCheckResult,
  AuditDataset,
  AuditFinding,
  AuditHealth,
  AuditSnapshot,
} from "./types";

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const;

function resolve(deps?: ProviderDeps) {
  return {
    services: deps?.services ?? accountingAiServices,
    period: deps?.period ?? currentPeriod(),
    today: deps?.today ?? todayISO(),
  };
}

/** Saúde operacional derivada apenas da contagem de inconsistências. */
export function computeAuditHealth(
  findings: readonly AuditFinding[],
  totalChecks: number,
): AuditHealth {
  const critical = findings.filter((f) => f.severity === "critical").length;
  const high = findings.filter((f) => f.severity === "high").length;
  const medium = findings.filter((f) => f.severity === "medium").length;
  const okChecks = Math.max(0, totalChecks - findings.length);
  const score = totalChecks === 0 ? 100 : Math.round((okChecks / totalChecks) * 100);

  if (critical > 0) return { level: "critico", label: "Crítico", score };
  if (high > 0) return { level: "alto", label: "Alto", score };
  if (medium > 0) return { level: "medio", label: "Médio", score };
  if (findings.length > 0) return { level: "baixo", label: "Baixo", score };
  return { level: "ok", label: "Sem inconsistências", score };
}

/** Executa as regras puras sobre um dataset já lido. */
export function runAuditRules(dataset: AuditDataset): AuditSnapshot {
  const checks: AuditCheckResult[] = AUDIT_RULES.map((rule) => {
    const found = rule.run(dataset);
    return {
      id: rule.id,
      category: rule.category,
      label: rule.label,
      ok: found === null,
      finding: found,
    };
  });

  const findings = checks
    .map((c) => c.finding)
    .filter((f): f is AuditFinding => f !== null)
    .sort((a, b) => {
      const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      return bySeverity !== 0 ? bySeverity : b.count - a.count;
    });

  const categories: AuditCategoryScore[] = (
    Object.keys(AUDIT_CATEGORY_LABELS) as AuditCategory[]
  ).map((category) => {
    const scoped = checks.filter((c) => c.category === category);
    return {
      category,
      label: AUDIT_CATEGORY_LABELS[category],
      total: scoped.length,
      ok: scoped.filter((c) => c.ok).length,
      findings: scoped.filter((c) => !c.ok).length,
      critical: scoped.filter((c) => c.finding?.severity === "critical").length,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    today: dataset.today,
    findings,
    checks,
    counts: {
      critical: findings.filter((f) => f.severity === "critical").length,
      high: findings.filter((f) => f.severity === "high").length,
      medium: findings.filter((f) => f.severity === "medium").length,
      low: findings.filter((f) => f.severity === "low").length,
      ok: checks.filter((c) => c.ok).length,
      total: checks.length,
    },
    categories,
    health: computeAuditHealth(findings, checks.length),
  };
}

/** Auditoria completa da empresa — somente leitura. */
export async function auditProvider(
  companyId: string,
  deps?: ProviderDeps,
): Promise<ProviderResult<AuditSnapshot>> {
  const { services, period, today } = resolve(deps);

  return readSafely("reports", async () => {
    const [
      transactions,
      sales,
      cashSessions,
      products,
      customers,
      fiscalDocuments,
      fiscalDefaults,
      stagnant,
    ] = await Promise.all([
      services.audit.transactions(companyId),
      services.audit.sales(companyId),
      services.audit.cashSessions(companyId),
      services.audit.products(companyId),
      services.audit.customers(companyId),
      services.audit.fiscalDocuments(companyId).catch(() => []),
      services.audit.fiscalDefaults(companyId).catch(() => null),
      services.audit.stagnantProducts(companyId).catch(() => []),
    ]);

    const tax = deps?.taxSnapshot ?? (await taxRegimeProvider(companyId, deps));
    const summary = deps?.summary ?? null;

    let equity: number | null = null;
    let netProfit: number | null = summary?.profit?.data?.netProfit ?? null;
    try {
      const balance = await services.accounting.balanceSheet(companyId, period.end);
      equity = balance.equity;
      if (netProfit === null) netProfit = balance.periodResult;
    } catch {
      equity = null;
    }

    const dataset: AuditDataset = {
      today,
      transactions,
      sales,
      cashSessions,
      products,
      customers,
      fiscalDocuments,
      fiscalDefaults,
      stagnant,
      tax: tax?.data ?? null,
      summary,
      equity,
      netProfit,
    };

    return runAuditRules(dataset);
  });
}
