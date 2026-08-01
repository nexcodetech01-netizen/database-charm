import { describe, expect, it } from "vitest";
import {
  BELLA_SALES_LINKS,
  BELLA_SALES_LINK_ORDER,
  SALES_CATEGORIES,
  buildBellaSalesView,
  buildSalesAlerts,
  buildSalesDetails,
  buildSalesHealth,
  buildSalesMetrics,
  buildSalesRecommendations,
  countSales,
  filterSalesInsights,
  filterSalesNotifications,
  formatSalesMetric,
  formatSalesTrend,
  isSalesCategory,
  saleDetailLink,
  salesCustomerLink,
  salesLink,
  salesLinkForAction,
  salesLinks,
  salesProductLink,
  type BellaSalesMetricsLike,
} from "../sales";
import { detectIntent, planIntent } from "../chat";
import { makeNotification, type BellaNotification } from "../proactive";
import type { AccountingInsight } from "../insights";
import { makeSummary } from "./fixtures";

const NOW = "2026-02-10T12:00:00.000Z";

function metricsFixture(over: Partial<BellaSalesMetricsLike> = {}): BellaSalesMetricsLike {
  return {
    dayCount: 4,
    dayTotal: 1200,
    monthCount: 40,
    monthTotal: 24000,
    averageTicket: 600,
    paidTotal: 24000,
    breakdown: [
      { status: "paid", count: 40, total: 24000 },
      { status: "pending", count: 5, total: 2500 },
      { status: "cancelled", count: 6, total: 3000 },
    ],
    ...over,
  };
}

function insight(over: Partial<AccountingInsight> = {}): AccountingInsight {
  return {
    id: "i1",
    severity: "warning",
    category: "receita",
    title: "Receita em queda",
    description: "Faturamento abaixo do mês anterior",
    recommendation: "Reforce a divulgação",
    priority: 80,
    action: { id: "aumentar_divulgacao", label: "Aumentar divulgação" },
    sourceProvider: "revenue",
    createdAt: NOW,
    ...over,
  };
}

function notification(
  over: Partial<Parameters<typeof makeNotification>[0]> = {},
): BellaNotification {
  return makeNotification({
    id: "n1",
    category: "clientes",
    severity: "critical",
    title: "Cliente inativo",
    message: "Cliente sem compra há 60 dias",
    recommendation: "Reative o cliente",
    action: "reativar_cliente",
    createdAt: NOW,
    ...over,
  });
}

describe("accounting-ai · vendas · links", () => {
  it("expõe destinos existentes e só navega", () => {
    expect(salesLinks()).toHaveLength(BELLA_SALES_LINK_ORDER.length);
    for (const link of salesLinks()) {
      expect(link.href.startsWith("/")).toBe(true);
    }
    expect(salesLink("abrir_vendas").href).toBe("/vendas");
    expect(salesLink("nova_venda").href).toBe("/vendas/novo");
    expect(salesLink("abrir_pdv").href).toBe("/pdv");
  });

  it("mapeia ações de insight/notificação para navegação comercial", () => {
    expect(salesLinkForAction({ id: "aumentar_divulgacao" })).toBe(
      BELLA_SALES_LINKS.abrir_clientes,
    );
    expect(salesLinkForAction({ id: "revisar_preco" })).toBe(BELLA_SALES_LINKS.abrir_produtos);
    expect(salesLinkForAction(null)).toBe(BELLA_SALES_LINKS.abrir_vendas);
  });

  it("aponta venda, cliente e produto quando existem", () => {
    expect(saleDetailLink("s1").href).toBe("/vendas/s1");
    expect(salesCustomerLink("c1").href).toBe("/clientes/c1");
    expect(salesProductLink("p1").href).toBe("/estoque/produto/p1");
  });
});

describe("accounting-ai · vendas · contagens", () => {
  it("conta pendentes, canceladas e proporção", () => {
    const c = countSales(metricsFixture());
    expect(c.dayCount).toBe(4);
    expect(c.monthTotal).toBe(24000);
    expect(c.pendingCount).toBe(5);
    expect(c.cancelledCount).toBe(6);
    expect(c.totalCount).toBe(51);
    expect(c.cancelRatio).toBeCloseTo(6 / 51, 5);
  });

  it("não inventa proporção sem breakdown", () => {
    const c = countSales(metricsFixture({ breakdown: [] }));
    expect(c.cancelRatio).toBeNull();
    expect(c.cancelledCount).toBe(0);
  });

  it("zera contagens sem métricas", () => {
    const c = countSales(null);
    expect(c.monthCount).toBe(0);
    expect(c.cancelRatio).toBeNull();
  });
});

describe("accounting-ai · vendas · resumo", () => {
  it("gera os 10 indicadores mesmo sem dados", () => {
    const metrics = buildSalesMetrics({});
    expect(metrics).toHaveLength(10);
    expect(metrics.every((m) => m.available === false)).toBe(true);
    expect(formatSalesMetric(metrics[0]!)).toBe("—");
  });

  it("formata moeda, contagem e percentual", () => {
    const metrics = buildSalesMetrics({ metrics: metricsFixture() });
    const faturamento = metrics.find((m) => m.id === "faturamento_mes")!;
    expect(faturamento.available).toBe(true);
    expect(formatSalesMetric(faturamento)).toContain("24.000");
    const vendas = metrics.find((m) => m.id === "vendas_mes")!;
    expect(formatSalesMetric(vendas)).toBe("40");
    const margem = metrics.find((m) => m.id === "margem_bruta")!;
    expect(margem.available).toBe(false);
    expect(formatSalesMetric({ ...margem, available: true, value: 0.325 })).toBe("32,5%");
  });

  it("usa margem, lucro e clientes do resumo contábil", async () => {
    const summary = await makeSummary();
    const metrics = buildSalesMetrics({ metrics: metricsFixture(), summary });
    const margem = metrics.find((m) => m.id === "margem_bruta")!;
    const lucro = metrics.find((m) => m.id === "lucro_liquido")!;
    expect(margem.available).toBe(summary.margin.available);
    expect(lucro.available).toBe(summary.profit.available);
  });

  it("monta detalhes de tendência, campeão e melhor cliente", async () => {
    const summary = await makeSummary();
    const details = buildSalesDetails({ metrics: metricsFixture(), summary });
    expect(details.map((d) => d.id)).toEqual([
      "tendencia_hoje",
      "tendencia_mes",
      "produto_mais_vendido",
      "melhor_cliente",
    ]);
    const best = details.find((d) => d.id === "produto_mais_vendido")!;
    if (best.available) expect(best.link.href.startsWith("/estoque/produto/")).toBe(true);
  });

  it("formata tendência já calculada sem recalcular", () => {
    expect(formatSalesTrend(null)).toBeNull();
    const text = formatSalesTrend({
      current: 1000,
      previous: 2000,
      delta: -1000,
      deltaPercent: -0.5,
      direction: "down",
      hasHistory: true,
      label: "Mês vs. anterior",
    })!;
    expect(text).toContain("▼");
    expect(text).toContain("50%");
  });
});

describe("accounting-ai · vendas · alertas", () => {
  it("emite alerta quando não há venda no dia", () => {
    const alerts = buildSalesAlerts(
      { metrics: metricsFixture({ dayCount: 0, dayTotal: 0 }) },
      { alertLimit: 20, now: NOW },
    );
    const item = alerts.find((a) => a.id === "sem_vendas_hoje")!;
    expect(item.severity).toBe("critical");
    expect(item.link.href).toBe("/pdv");
  });

  it("emite cancelamentos e pendências a partir do breakdown existente", () => {
    const alerts = buildSalesAlerts({ metrics: metricsFixture() }, { alertLimit: 20, now: NOW });
    const ids = alerts.map((a) => a.id);
    expect(ids).toContain("muitas_canceladas");
    expect(ids).toContain("vendas_pendentes");
  });

  it("não acusa cancelamento acima do limite quando está dentro do normal", () => {
    const alerts = buildSalesAlerts(
      {
        metrics: metricsFixture({
          breakdown: [
            { status: "paid", count: 100, total: 50000 },
            { status: "cancelled", count: 1, total: 200 },
          ],
        }),
      },
      { alertLimit: 20, now: NOW },
    );
    expect(alerts.map((a) => a.id)).not.toContain("muitas_canceladas");
  });

  it("inclui notificações proativas de categoria comercial", () => {
    const alerts = buildSalesAlerts(
      { metrics: metricsFixture(), notifications: [notification()] },
      { alertLimit: 20, now: NOW },
    );
    const proactive = alerts.find((a) => a.source === "proactive")!;
    expect(proactive.link.href).toBe("/clientes");
  });

  it("ignora notificações de categorias não comerciais", () => {
    expect(filterSalesNotifications([notification({ id: "n2", category: "fiscal" })])).toHaveLength(
      0,
    );
    expect(SALES_CATEGORIES.every((c) => isSalesCategory(c))).toBe(true);
    expect(isSalesCategory("fiscal")).toBe(false);
  });

  it("respeita o limite de alertas", () => {
    const alerts = buildSalesAlerts(
      { metrics: metricsFixture({ dayCount: 0 }) },
      { alertLimit: 2, now: NOW },
    );
    expect(alerts).toHaveLength(2);
  });
});

describe("accounting-ai · vendas · recomendações", () => {
  it("reaproveita insights comerciais e navega", () => {
    const recs = buildSalesRecommendations([
      insight(),
      insight({ id: "i2", category: "estoque", action: { id: "comprar_estoque", label: "x" } }),
    ]);
    expect(recs).toHaveLength(1);
    expect(recs[0]!.link.href).toBe("/clientes");
    expect(filterSalesInsights([insight({ id: "i3", category: "fiscal" })])).toHaveLength(0);
  });
});

describe("accounting-ai · vendas · view", () => {
  it("marca indisponibilidade sem nenhum dado", () => {
    const view = buildBellaSalesView({}, { now: NOW });
    expect(view.available).toBe(false);
    expect(view.missing).toContain("métricas de vendas");
    expect(view.missing).toContain("resumo contábil");
    expect(view.health).toBeNull();
  });

  it("monta o painel completo com dados reais do resumo", async () => {
    const summary = await makeSummary();
    const view = buildBellaSalesView(
      { metrics: metricsFixture(), summary },
      { now: NOW, alertLimit: 10 },
    );
    expect(view.available).toBe(true);
    expect(view.generatedAt).toBe(NOW);
    expect(view.metrics).toHaveLength(10);
    expect(view.details).toHaveLength(4);
    expect(view.missing).toHaveLength(0);
    expect(buildSalesHealth(summary)?.level).toBe(
      summary.health.available ? summary.health.data!.level : undefined,
    );
  });
});

describe("accounting-ai · vendas · chat", () => {
  it("reconhece perguntas comerciais", () => {
    for (const q of [
      "Como estão minhas vendas?",
      "O que mais vende?",
      "Situação das vendas",
      "As vendas estão caindo?",
    ]) {
      expect(detectIntent(q).intent).toBe("situacao_vendas");
    }
  });

  it("planeja apenas skills já existentes", () => {
    const plan = planIntent(detectIntent("como estão minhas vendas?"));
    expect(plan.intent).toBe("situacao_vendas");
    expect(plan.steps.map((s) => s.skillId)).toEqual([
      "consultar_receita",
      "consultar_ticket",
      "consultar_produtos",
      "consultar_clientes",
      "consultar_recomendacoes",
    ]);
  });
});
