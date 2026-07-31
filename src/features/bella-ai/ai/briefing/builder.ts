/**
 * Briefing Builder — orquestra a coleta dos DTOs via Application Layer
 * (Use Cases) e monta o `DailyBriefing.v1`.
 *
 * REGRAS:
 *   - Consumo exclusivo via `ToolExecutors` (mesma porta usada por
 *     Actions / Workflows). Nenhum acesso a Repositories, Supabase,
 *     Engine ou Resolver.
 *   - Zero cálculo novo. Toda contagem, tom e mensagem vem do DTO.
 *   - Fonte indisponível → card `Dado indisponível.` e `unavailable`
 *     em `unavailableSources`. Nunca estimar.
 */
import type { CommercialDashboardDTO } from "@/features/pricing/lib/commercial-dashboard.functions";
import type { ToolExecutors } from "../tools/executors";
import {
  BRIEFING_VERSION,
  systemBriefingClock,
  type BriefingCard,
  type BriefingClock,
  type BriefingSourceId,
  type DailyBriefing,
} from "./contracts";
import {
  BRIEFING_SOURCE_REGISTRY,
  BRIEFING_SUGGESTED_QUESTIONS,
} from "./registry";

export interface BuildBriefingInput {
  readonly companyId: string;
  readonly traceId: string;
  readonly userName?: string;
}

export interface BriefingBuilderDeps {
  readonly executors: ToolExecutors;
  readonly clock?: BriefingClock;
}

const UNAVAILABLE_VALUE = "Dado indisponível.";

function greetingFor(nowIso: string, userName?: string): string {
  const hour = new Date(nowIso).getUTCHours();
  // Aproximação de horário BR (UTC-3). Sem cálculo de negócio.
  const localHour = (hour - 3 + 24) % 24;
  const base =
    localHour < 12 ? "Bom dia" : localHour < 18 ? "Boa tarde" : "Boa noite";
  return userName ? `${base}, ${userName}!` : `${base}!`;
}

function unavailableCard(
  section: BriefingCard["section"],
  id: string,
  title: string,
  source: BriefingSourceId,
  timestamp: string,
): BriefingCard {
  const desc = BRIEFING_SOURCE_REGISTRY[source];
  return {
    id,
    section,
    title,
    value: UNAVAILABLE_VALUE,
    tone: "neutral",
    source,
    useCase: desc.useCase,
    confidence: "unavailable",
    timestamp,
    available: false,
  };
}

function buildCommercialCards(
  dto: CommercialDashboardDTO,
  timestamp: string,
): BriefingCard[] {
  const useCase = BRIEFING_SOURCE_REGISTRY.commercial.useCase;
  const kpis = dto.kpis;
  const cards: BriefingCard[] = [];

  // Overview — saúde comercial
  cards.push({
    id: "overview.commercial_health",
    section: "overview",
    title: `Saúde comercial: ${dto.health.label}`,
    value: dto.health.summary,
    detail: `${dto.health.stars} de 5 estrelas`,
    tone:
      dto.health.level === "critical"
        ? "critical"
        : dto.health.level === "attention"
          ? "warning"
          : "positive",
    source: "commercial",
    useCase,
    confidence: "high",
    timestamp: kpis.lastUpdatedAt || timestamp,
    available: true,
  });

  // KPIs — produtos p/ reajuste
  cards.push({
    id: "kpis.products_with_suggestion",
    section: "kpis",
    title: "Produtos para reajuste",
    value: String(kpis.productsWithSuggestion),
    detail: `${kpis.productsTotal} produtos analisados`,
    tone: kpis.productsWithSuggestion > 0 ? "warning" : "positive",
    source: "commercial",
    useCase,
    confidence: "high",
    timestamp: kpis.lastUpdatedAt || timestamp,
    available: true,
  });

  // Alerts — abaixo da margem mínima
  cards.push({
    id: "alerts.products_below_margin",
    section: "alerts",
    title: "Produtos abaixo da margem mínima",
    value: String(kpis.productsBelowMargin),
    tone: kpis.productsBelowMargin > 0 ? "critical" : "positive",
    source: "commercial",
    useCase,
    confidence: "high",
    timestamp: kpis.lastUpdatedAt || timestamp,
    available: true,
  });

  // Alerts — sem preço
  cards.push({
    id: "alerts.products_without_price",
    section: "alerts",
    title: "Produtos sem preço",
    value: String(kpis.productsWithoutPrice),
    tone: kpis.productsWithoutPrice > 0 ? "warning" : "positive",
    source: "commercial",
    useCase,
    confidence: "high",
    timestamp: kpis.lastUpdatedAt || timestamp,
    available: true,
  });

  // Alerts — sem custo
  cards.push({
    id: "alerts.products_without_cost",
    section: "alerts",
    title: "Produtos sem custo",
    value: String(kpis.productsWithoutCost),
    tone: kpis.productsWithoutCost > 0 ? "warning" : "positive",
    source: "commercial",
    useCase,
    confidence: "high",
    timestamp: kpis.lastUpdatedAt || timestamp,
    available: true,
  });

  // Priorities — top 3 priorityProducts
  const top = dto.priorityProducts.slice(0, 3);
  top.forEach((p, i) => {
    cards.push({
      id: `priorities.priority_${i + 1}`,
      section: "priorities",
      title: `Prioridade ${i + 1}: ${p.name}`,
      value: `Preço recomendado difere em ${(p.differenceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
      detail: `Margem atual ${p.marginPct.toFixed(1)}% • origem ${p.originLabel}`,
      tone: p.marginPct < 0 ? "critical" : "warning",
      source: "commercial",
      useCase,
      confidence: "high",
      timestamp: kpis.lastUpdatedAt || timestamp,
      available: true,
    });
  });

  // Next actions — oportunidades
  dto.opportunities.slice(0, 3).forEach((op, i) => {
    cards.push({
      id: `next_actions.opportunity_${i + 1}`,
      section: "next_actions",
      title: op.title,
      value: op.description,
      detail: `${op.count} item(ns) • ${op.actionLabel}`,
      tone: op.kind === "below_min_margin" ? "critical" : "warning",
      source: "commercial",
      useCase,
      confidence: "high",
      timestamp: kpis.lastUpdatedAt || timestamp,
      available: true,
    });
  });

  return cards;
}

export function createBriefingBuilder(deps: BriefingBuilderDeps) {
  const clock = deps.clock ?? systemBriefingClock;

  return {
    async build(input: BuildBriefingInput): Promise<DailyBriefing> {
      const started = clock.monotonicMs();
      const nowIso = clock.nowIso();

      const resolvedSources: BriefingSourceId[] = [];
      const unavailableSources: BriefingSourceId[] = [];
      const cards: BriefingCard[] = [];

      // Fonte 1 — Commercial (única disponível na v1).
      try {
        const commercial = await deps.executors.getCommercialDashboard({
          companyId: input.companyId,
        });
        cards.push(...buildCommercialCards(commercial, nowIso));
        resolvedSources.push("commercial");
      } catch {
        cards.push(
          unavailableCard(
            "overview",
            "overview.commercial_health",
            "Saúde comercial",
            "commercial",
            nowIso,
          ),
        );
        unavailableSources.push("commercial");
      }

      // Demais fontes — placeholders explícitos ("Dado indisponível.").
      const placeholders: Array<{
        section: BriefingCard["section"];
        id: string;
        title: string;
        source: BriefingSourceId;
      }> = [
        {
          section: "kpis",
          id: "kpis.revenue_yesterday",
          title: "Receita de ontem",
          source: "sales",
        },
        {
          section: "kpis",
          id: "kpis.receivables_today",
          title: "Contas a receber hoje",
          source: "financial",
        },
        {
          section: "alerts",
          id: "alerts.payables_due_today",
          title: "Contas vencendo hoje",
          source: "financial",
        },
        {
          section: "alerts",
          id: "alerts.low_stock",
          title: "Produtos com estoque baixo",
          source: "inventory",
        },
        {
          section: "alerts",
          id: "alerts.pending_purchases",
          title: "Compras pendentes",
          source: "purchases",
        },
      ];

      for (const p of placeholders) {
        const desc = BRIEFING_SOURCE_REGISTRY[p.source];
        if (desc.available) continue; // placeholder só entra quando fonte não está plugada
        cards.push(unavailableCard(p.section, p.id, p.title, p.source, nowIso));
        if (!unavailableSources.includes(p.source)) {
          unavailableSources.push(p.source);
        }
      }

      const durationMs = Math.max(0, clock.monotonicMs() - started);

      return {
        version: BRIEFING_VERSION,
        traceId: input.traceId,
        occurredAt: nowIso,
        companyId: input.companyId,
        greeting: greetingFor(nowIso, input.userName),
        cards,
        suggestedQuestions: [...BRIEFING_SUGGESTED_QUESTIONS],
        suggestedActions: [
          {
            id: "briefing.open_commercial_dashboard",
            label: "Abrir Dashboard Comercial",
            intent: "commercial.dashboard",
            payload: { companyId: input.companyId },
            requiresApproval: false,
            scopes: ["commercial:read"],
          },
          {
            id: "briefing.open_simulator",
            label: "Simular preço",
            intent: "commercial.pricing.simulate",
            payload: { companyId: input.companyId },
            requiresApproval: false,
            scopes: ["commercial:read"],
          },
        ],
        resolvedSources,
        unavailableSources,
        durationMs,
      };
    },
  };
}

export type BriefingBuilder = ReturnType<typeof createBriefingBuilder>;
