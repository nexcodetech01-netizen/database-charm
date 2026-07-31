import { describe, expect, it, vi } from "vitest";
import {
  BRIEFING_SOURCE_REGISTRY,
  BRIEFING_VERSION,
  createBriefingBuilder,
  dailyBriefingSchema,
  formatDailyBriefing,
  type BriefingClock,
} from "../ai";
import type { ToolExecutors } from "../ai/tools/executors";
import type { CommercialDashboardDTO } from "@/features/pricing/lib/commercial-dashboard.functions";

function fakeClock(iso: string): BriefingClock {
  let t = 0;
  return {
    nowIso: () => iso,
    monotonicMs: () => {
      const cur = t;
      t += 5;
      return cur;
    },
  };
}

const commercialFixture: CommercialDashboardDTO = {
  health: {
    level: "attention",
    stars: 3,
    label: "Requer atenção",
    summary: "Alguns produtos estão fora da política.",
  },
  kpis: {
    productsTotal: 120,
    productsWithOwnPolicy: 40,
    productsInheritingPolicy: 60,
    productsBelowMargin: 4,
    productsWithoutCost: 2,
    productsWithoutPrice: 1,
    productsWithSuggestion: 7,
    lastUpdatedAt: "2026-07-14T09:00:00.000Z",
  },
  opportunities: [
    {
      kind: "below_min_margin",
      count: 4,
      title: "Produtos abaixo da margem",
      description: "Revise 4 itens críticos.",
      actionLabel: "Ver produtos",
      actionHref: "/inteligencia-comercial/revisao-precos",
    },
  ],
  priorityProducts: [
    {
      productId: "p1",
      name: "Bolsa Alfa",
      categoryId: "c1",
      categoryName: "Bolsas",
      currentPriceCents: 10_000,
      recommendedPriceCents: 12_500,
      differenceCents: 2_500,
      marginPct: 32.5,
      originLayer: "category",
      originLabel: "Categoria",
    },
  ],
  categories: [],
  recentDecisions: [],
  insights: [],
  reviewList: [],
};

function makeExecutors(
  overrides: Partial<ToolExecutors> = {},
): ToolExecutors {
  const base: ToolExecutors = {
    getCommercialDashboard: vi.fn(async () => commercialFixture),
    getCompanyPolicyOverview: vi.fn(),
    getCategoryPoliciesOverview: vi.fn(),
    getProductPricingIntelligence: vi.fn(),
    simulatePricing: vi.fn(),
    applyProductSuggestedPrice: vi.fn(),
  } as unknown as ToolExecutors;
  return { ...base, ...overrides };
}

describe("Briefing Registry", () => {
  it("declara apenas commercial como disponível na v1", () => {
    expect(BRIEFING_SOURCE_REGISTRY.commercial.available).toBe(true);
    expect(BRIEFING_SOURCE_REGISTRY.financial.available).toBe(false);
    expect(BRIEFING_SOURCE_REGISTRY.inventory.available).toBe(false);
    expect(BRIEFING_SOURCE_REGISTRY.sales.available).toBe(false);
    expect(BRIEFING_SOURCE_REGISTRY.purchases.available).toBe(false);
  });

  it("cada descriptor aponta para um Use Case nomeado", () => {
    for (const desc of Object.values(BRIEFING_SOURCE_REGISTRY)) {
      expect(desc.useCase).toMatch(/^Get.+Dashboard$/);
    }
  });
});

describe("Briefing Builder", () => {
  const clock = fakeClock("2026-07-14T12:00:00.000Z");

  it("monta DailyBriefing.v1 válido a partir do Commercial Dashboard", async () => {
    const builder = createBriefingBuilder({
      executors: makeExecutors(),
      clock,
    });
    const briefing = await builder.build({
      companyId: "co-1",
      traceId: "tr-1",
      userName: "Ana",
    });

    expect(briefing.version).toBe(BRIEFING_VERSION);
    expect(() => dailyBriefingSchema.parse(briefing)).not.toThrow();
    expect(briefing.greeting).toMatch(/Ana/);
    expect(briefing.resolvedSources).toContain("commercial");
    expect(briefing.unavailableSources).toEqual(
      expect.arrayContaining(["financial", "inventory", "sales", "purchases"]),
    );
    expect(briefing.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("todo card carrega source, confidence e timestamp", async () => {
    const builder = createBriefingBuilder({
      executors: makeExecutors(),
      clock,
    });
    const briefing = await builder.build({
      companyId: "co-1",
      traceId: "tr-2",
    });

    for (const card of briefing.cards) {
      expect(card.source).toBeTruthy();
      expect(card.confidence).toBeTruthy();
      expect(card.timestamp).toBeTruthy();
      expect(card.useCase).toBeTruthy();
    }
  });

  it("fontes não plugadas geram card 'Dado indisponível.' — nunca estima", async () => {
    const builder = createBriefingBuilder({
      executors: makeExecutors(),
      clock,
    });
    const briefing = await builder.build({
      companyId: "co-1",
      traceId: "tr-3",
    });
    const unavailable = briefing.cards.filter((c) => !c.available);
    expect(unavailable.length).toBeGreaterThan(0);
    for (const c of unavailable) {
      expect(c.value).toBe("Dado indisponível.");
      expect(c.confidence).toBe("unavailable");
    }
  });

  it("quando o Commercial Use Case falha, marca fonte como indisponível", async () => {
    const builder = createBriefingBuilder({
      executors: makeExecutors({
        getCommercialDashboard: vi.fn(async () => {
          throw new Error("boom");
        }),
      }),
      clock,
    });
    const briefing = await builder.build({
      companyId: "co-1",
      traceId: "tr-4",
    });
    expect(briefing.resolvedSources).not.toContain("commercial");
    expect(briefing.unavailableSources).toContain("commercial");
  });

  it("consome apenas ToolExecutors — não importa Repositories/Supabase", async () => {
    const spy = vi.fn(async () => commercialFixture);
    const builder = createBriefingBuilder({
      executors: makeExecutors({ getCommercialDashboard: spy }),
      clock,
    });
    await builder.build({ companyId: "co-9", traceId: "tr-5" });
    expect(spy).toHaveBeenCalledWith({ companyId: "co-9" });
  });
});

describe("Briefing Formatter", () => {
  const clock = fakeClock("2026-07-14T12:00:00.000Z");

  it("produz AIResponse.v1 com sugestões e fontes", async () => {
    const briefing = await createBriefingBuilder({
      executors: makeExecutors(),
      clock,
    }).build({ companyId: "co-1", traceId: "tr-fmt" });

    const resp = formatDailyBriefing(briefing);
    expect(resp.version).toBe("AIResponse.v1");
    expect(resp.confidence).toBe("medium"); // commercial ok + demais indisponíveis
    expect(resp.suggestedQuestions).toEqual([
      "Quais produtos reajustar?",
      "Mostrar contas vencendo",
      "Abrir Dashboard Comercial",
      "Simular preço",
    ]);
    expect(resp.sources.length).toBeGreaterThan(0);
    expect(resp.warnings.some((w) => w.code === "stale_data")).toBe(true);
    expect(resp.summary).toMatch(/Resumo|KPIs do dia/);
  });

  it("marca confidence=low quando nenhuma fonte respondeu", async () => {
    const briefing = await createBriefingBuilder({
      executors: makeExecutors({
        getCommercialDashboard: vi.fn(async () => {
          throw new Error("down");
        }),
      }),
      clock,
    }).build({ companyId: "co-1", traceId: "tr-fmt-2" });

    const resp = formatDailyBriefing(briefing);
    expect(resp.confidence).toBe("low");
  });
});
