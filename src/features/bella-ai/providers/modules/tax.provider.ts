/**
 * Bella Contadora — provider tributário.
 *
 * Consome EXCLUSIVAMENTE o motor tributário (`taxService`), que lê
 * perfil, vendas e apurações reais do banco. Sem mocks: sem perfil
 * tributário configurado, o provider devolve listas vazias.
 */

import {
  buildTaxAlerts,
  distributableProfit,
  taxBurden,
  taxService,
  toCompetence,
  type CompanyTaxProfile,
  type TaxApportionment,
  type TaxProjection,
} from "@/features/tax";
import { accountingQuery } from "./accounting.provider";
import type {
  BellaAlert,
  BellaInsight,
  BellaMetric,
  BellaModuleProvider,
  BellaProviderContext,
  BellaSuggestion,
  BellaSummary,
} from "./base";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${v.toFixed(2).replace(".", ",")}%`;

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

function previousCompetence(competence: string): string {
  const d = new Date(`${competence}T00:00:00`);
  d.setMonth(d.getMonth() - 1);
  return toCompetence(d);
}

export interface TaxSnapshot {
  profile: CompanyTaxProfile;
  current: TaxApportionment | null;
  previous: TaxApportionment | null;
  history: TaxApportionment[];
  rbt12: number;
  revenue: number;
}

export const taxQuery = {
  async profile(companyId: string): Promise<CompanyTaxProfile | null> {
    return safe(() => taxService.getProfile(companyId));
  },

  async apportionment(companyId: string, competence = toCompetence()) {
    return safe(() => taxService.getApportionment(companyId, competence));
  },

  async generate(companyId: string, competence = toCompetence(), close = false) {
    return safe(() => taxService.generateApportionment(companyId, competence, close));
  },

  async history(companyId: string, limit = 12) {
    return (await safe(() => taxService.listApportionments(companyId, limit))) ?? [];
  },

  async projection(companyId: string, competence = toCompetence()): Promise<TaxProjection | null> {
    return safe(() => taxService.projectScenarios(companyId, competence));
  },

  async snapshot(companyId: string, competence = toCompetence()): Promise<TaxSnapshot | null> {
    const profile = await safe(() => taxService.getProfile(companyId));
    if (!profile) return null;
    const [current, previous, history, rbt12, revenue] = await Promise.all([
      safe(() => taxService.getApportionment(companyId, competence)),
      safe(() => taxService.getApportionment(companyId, previousCompetence(competence))),
      safe(() => taxService.listApportionments(companyId, 12)),
      safe(() => taxService.rbt12(companyId, competence)),
      safe(() => taxService.monthlyRevenue(companyId, competence)),
    ]);
    return {
      profile,
      current: current ?? null,
      previous: previous ?? null,
      history: history ?? [],
      rbt12: rbt12 ?? profile.rbt12,
      revenue: revenue ?? 0,
    };
  },

  /** Quanto sobra líquido e quanto pode ser distribuído. */
  async distributable(companyId: string, competence = toCompetence()) {
    const [dre, snap] = await Promise.all([
      accountingQuery.currentDre(companyId),
      this.snapshot(companyId, competence),
    ]);
    if (!dre) return null;
    const pending =
      snap?.current && snap.current.status !== "paid" ? snap.current.taxAmount : 0;
    return {
      netProfit: dre.netProfit,
      pendingTaxes: pending,
      distributable: distributableProfit(dre.netProfit, pending),
    };
  },
};

export const taxProvider: BellaModuleProvider = {
  module: "tax",
  displayName: "Tributário",

  async getInsights(ctx: BellaProviderContext): Promise<BellaInsight[]> {
    const snap = await taxQuery.snapshot(ctx.companyId);
    if (!snap) return [];
    const now = new Date().toISOString();
    const insights: BellaInsight[] = [];

    if (snap.current) {
      insights.push({
        id: `tax.current.${snap.current.competence}`,
        module: "tax",
        title: `DAS apurado: ${BRL.format(snap.current.taxAmount)}`,
        description: `Competência ${snap.current.competence} com alíquota efetiva de ${pct(
          snap.current.effectiveRate,
        )} sobre ${BRL.format(snap.current.revenue)}.`,
        priority: "high",
        createdAt: now,
      });
    }

    if (snap.previous && snap.current) {
      const delta = snap.current.taxAmount - snap.previous.taxAmount;
      insights.push({
        id: "tax.delta",
        module: "tax",
        title: delta >= 0 ? "Tributos aumentaram" : "Tributos reduziram",
        description: `Variação de ${BRL.format(Math.abs(delta))} em relação à competência anterior.`,
        priority: delta > 0 ? "medium" : "low",
        createdAt: now,
      });
    }

    return insights;
  },

  async getSummary(ctx: BellaProviderContext): Promise<BellaSummary> {
    const snap = await taxQuery.snapshot(ctx.companyId);
    const updatedAt = new Date().toISOString();
    if (!snap) {
      return {
        module: "tax",
        headline: "Perfil tributário não configurado.",
        highlights: ["Cadastre o regime e o anexo para apurar tributos automaticamente."],
        updatedAt,
      };
    }
    return {
      module: "tax",
      headline: snap.current
        ? `DAS de ${snap.current.competence}: ${BRL.format(snap.current.taxAmount)}`
        : "Nenhuma apuração gerada para a competência atual.",
      highlights: [
        `RBT12: ${BRL.format(snap.rbt12)}`,
        `Receita do mês: ${BRL.format(snap.revenue)}`,
        snap.current
          ? `Alíquota efetiva: ${pct(snap.current.effectiveRate)}`
          : `Regime: ${snap.profile.taxRegime}`,
      ],
      updatedAt,
    };
  },

  async getAlerts(ctx: BellaProviderContext): Promise<BellaAlert[]> {
    const snap = await taxQuery.snapshot(ctx.companyId);
    if (!snap) return [];
    const now = new Date().toISOString();
    return buildTaxAlerts({
      annex: snap.profile.simplesAnnex,
      rbt12: snap.rbt12,
      current: snap.current,
      previous: snap.previous,
    }).map((a) => ({
      id: a.id,
      module: "tax" as const,
      title: a.title,
      description: a.description,
      severity: a.level,
      createdAt: now,
    }));
  },

  async getMetrics(ctx: BellaProviderContext): Promise<BellaMetric[]> {
    const snap = await taxQuery.snapshot(ctx.companyId);
    if (!snap) return [];
    const burden = snap.current ? taxBurden(snap.current.taxAmount, snap.current.revenue) : 0;
    return [
      { key: "tax.rbt12", label: "RBT12", value: BRL.format(snap.rbt12) },
      {
        key: "tax.effective_rate",
        label: "Alíquota efetiva",
        value: pct(snap.current?.effectiveRate ?? snap.profile.effectiveRate),
      },
      { key: "tax.das", label: "DAS do mês", value: BRL.format(snap.current?.taxAmount ?? 0) },
      { key: "tax.burden", label: "Carga tributária", value: pct(burden) },
    ];
  },

  async getSuggestions(ctx: BellaProviderContext): Promise<BellaSuggestion[]> {
    const snap = await taxQuery.snapshot(ctx.companyId);
    if (!snap) {
      return [
        {
          id: "tax.setup_profile",
          module: "tax",
          title: "Configurar perfil tributário",
          description: "Sem regime e anexo cadastrados não é possível apurar o DAS automaticamente.",
          actionLabel: "Configurar",
          priority: "high",
        },
      ];
    }
    const suggestions: BellaSuggestion[] = [];
    if (!snap.current) {
      suggestions.push({
        id: "tax.generate_apportionment",
        module: "tax",
        title: "Gerar apuração do mês",
        description: "A competência atual ainda não foi apurada.",
        actionLabel: "Apurar",
        priority: "high",
      });
    }
    if (snap.current && snap.current.status !== "paid") {
      suggestions.push({
        id: "tax.reserve_cash",
        module: "tax",
        title: `Reservar ${BRL.format(snap.current.taxAmount)} para tributos`,
        description: `Vencimento em ${snap.current.dueDate ?? "data a definir"}.`,
        priority: "medium",
      });
    }
    return suggestions;
  },
};
