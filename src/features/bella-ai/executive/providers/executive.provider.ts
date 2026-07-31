/**
 * Bella Executive — provider do módulo executivo.
 *
 * Expõe o resumo executivo pelo mesmo contrato dos demais providers.
 * Não recalcula nada: consome o `executiveService`, que consome a RPC
 * `generate_executive_summary`.
 */

import { executiveService } from "../services/executive.service";
import type { ExecutiveReport } from "../types";
import type {
  BellaAlert,
  BellaInsight,
  BellaMetric,
  BellaModuleProvider,
  BellaProviderContext,
  BellaSuggestion,
  BellaSummary,
} from "../../providers/modules/base";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const MODULE = "executive" as const;

async function safeReport(companyId: string): Promise<ExecutiveReport | null> {
  try {
    return await executiveService.report(companyId);
  } catch {
    return null;
  }
}

export const executiveQuery = {
  report: safeReport,
  async rankings(companyId: string) {
    const report = await safeReport(companyId);
    return report ? executiveService.rankings(report) : null;
  },
};

function formatKpi(value: number | null, format: string): string {
  if (value == null) return "—";
  if (format === "currency") return BRL.format(value);
  if (format === "percent") return `${value.toFixed(1).replace(".", ",")}%`;
  if (format === "days") return `${Math.round(value)} dias`;
  if (format === "ratio") return `${value.toFixed(2).replace(".", ",")}x`;
  return String(Math.round(value));
}

export const executiveProvider: BellaModuleProvider = {
  module: MODULE,
  displayName: "Bella Executive",

  async getInsights(ctx: BellaProviderContext): Promise<BellaInsight[]> {
    const report = await safeReport(ctx.companyId);
    if (!report) return [];
    return report.insights.map((i) => ({
      id: `executive-${i.id}`,
      module: MODULE,
      title: i.title,
      description: i.description,
      priority: i.severity === "critical" ? "urgent" : i.severity === "warning" ? "high" : "medium",
      createdAt: report.snapshot.generatedAt,
    }));
  },

  async getSummary(ctx: BellaProviderContext): Promise<BellaSummary> {
    const report = await safeReport(ctx.companyId);
    if (!report) {
      return {
        module: MODULE,
        headline: "Ainda não consigo montar o panorama executivo desta empresa.",
        highlights: [],
        updatedAt: new Date().toISOString(),
      };
    }
    const { dre, cash } = report.snapshot;
    return {
      module: MODULE,
      headline: `Receita ${BRL.format(dre.grossRevenue)} • Lucro ${BRL.format(dre.netProfit)} • Score ${report.risk.overallScore}/100`,
      highlights: [
        `EBITDA: ${BRL.format(dre.ebitda)} (${dre.ebitdaMargin.toFixed(1)}%)`,
        `Caixa disponível: ${BRL.format(cash.available)}`,
        `A receber: ${BRL.format(cash.receivable)} • A pagar: ${BRL.format(cash.payable)}`,
        `Risco global: ${report.risk.severity}`,
      ],
      updatedAt: report.snapshot.generatedAt,
    };
  },

  async getAlerts(ctx: BellaProviderContext): Promise<BellaAlert[]> {
    const report = await safeReport(ctx.companyId);
    if (!report) return [];
    return report.alerts.map((a) => ({
      id: `executive-${a.id}`,
      module: MODULE,
      title: a.title,
      description: a.description,
      severity: a.severity,
      createdAt: report.snapshot.generatedAt,
    }));
  },

  async getMetrics(ctx: BellaProviderContext): Promise<BellaMetric[]> {
    const report = await safeReport(ctx.companyId);
    if (!report) return [];
    const keys = [
      "revenue",
      "net_profit",
      "ebitda",
      "net_margin",
      "cash_available",
      "working_capital",
      "receivable",
      "payable",
      "inventory_value",
      "inventory_turnover",
      "average_ticket",
      "estimated_tax",
    ];
    return report.kpis
      .filter((k) => keys.includes(k.key))
      .map((k) => ({
        key: k.key,
        label: k.label,
        value: formatKpi(k.value, k.format),
        hint: k.hint,
      }));
  },

  async getSuggestions(ctx: BellaProviderContext): Promise<BellaSuggestion[]> {
    const report = await safeReport(ctx.companyId);
    if (!report) return [];
    return report.recommendations.map((r) => ({
      id: `executive-${r.id}`,
      module: MODULE,
      title: r.title,
      description: r.description,
      priority: r.priority,
    }));
  },
};
