import { describe, expect, it } from "vitest";
import {
  BELLA_INVENTORY_LINKS,
  BELLA_INVENTORY_LINK_ORDER,
  INVENTORY_CATEGORIES,
  buildBellaInventoryView,
  buildInventoryAlerts,
  buildInventoryDetails,
  buildInventoryHealth,
  buildInventoryMetrics,
  buildInventoryRecommendations,
  countInbound,
  countInventory,
  filterInventoryInsights,
  filterInventoryNotifications,
  formatInventoryMetric,
  inventoryLink,
  inventoryLinkForAction,
  inventoryLinks,
  inventoryProductLink,
  isInventoryCategory,
  lastMovementAt,
  type BellaInventoryMetricsLike,
  type BellaInventoryMovementLike,
} from "../inventory";
import { detectIntent, planIntent } from "../chat";
import { makeNotification, type BellaNotification } from "../proactive";
import type { AccountingInsight } from "../insights";
import { makeSummary } from "./fixtures";

const NOW = "2026-02-10T12:00:00.000Z";

function metricsFixture(
  over: Partial<BellaInventoryMetricsLike> = {},
): BellaInventoryMetricsLike {
  return {
    productCount: 120,
    totalItems: 3400,
    inventoryValue: 82000,
    todayMovements: 5,
    belowMin: [
      { id: "p1", name: "Caneta azul", sku: "CAN-1", stock: 0, min_stock: 10 },
      { id: "p2", name: "Caderno", sku: "CAD-1", stock: 11, min_stock: 10 },
      { id: "p3", name: "Borracha", sku: "BOR-1", stock: -2, min_stock: 5 },
    ],
    stagnant: [{ id: "p9", name: "Régua", sku: "REG-1", stock: 40, cost: 3 }],
    ...over,
  };
}

function movement(over: Partial<BellaInventoryMovementLike> = {}): BellaInventoryMovementLike {
  return {
    id: "m1",
    type: "out",
    quantity: 2,
    movement_date: "2026-02-09T10:00:00.000Z",
    ...over,
  };
}

function insight(over: Partial<AccountingInsight> = {}): AccountingInsight {
  return {
    id: "i1",
    severity: "warning",
    category: "estoque",
    title: "Estoque crítico",
    description: "Itens abaixo do mínimo",
    recommendation: "Programe a reposição",
    priority: 80,
    action: { id: "comprar_estoque", label: "Comprar estoque" },
    sourceProvider: "inventory",
    createdAt: NOW,
    ...over,
  };
}

function notification(
  over: Partial<Parameters<typeof makeNotification>[0]> = {},
): BellaNotification {
  return makeNotification({
    id: "n1",
    category: "estoque",
    severity: "critical",
    title: "Produto acabando",
    message: "Saldo abaixo do mínimo",
    recommendation: "Compre agora",
    action: "comprar_estoque",
    createdAt: NOW,
    ...over,
  });
}

describe("accounting-ai · estoque · links", () => {
  it("expõe destinos existentes e só navega", () => {
    expect(inventoryLinks()).toHaveLength(BELLA_INVENTORY_LINK_ORDER.length);
    for (const link of inventoryLinks()) {
      expect(link.href.startsWith("/")).toBe(true);
    }
    expect(inventoryLink("abrir_inventario").href).toBe("/estoque/reconciliacao");
    expect(inventoryLink("abrir_compras").href).toBe("/compras");
  });

  it("mapeia ações de insight/notificação para navegação de estoque", () => {
    expect(inventoryLinkForAction({ id: "comprar_estoque" })).toBe(
      BELLA_INVENTORY_LINKS.abrir_compras,
    );
    expect(inventoryLinkForAction(null)).toBe(BELLA_INVENTORY_LINKS.abrir_estoque);
  });

  it("aponta o produto quando existe", () => {
    expect(inventoryProductLink("abc").href).toBe("/estoque/produto/abc");
  });
});

describe("accounting-ai · estoque · contagens", () => {
  it("conta ruptura, negativos, próximos do mínimo e parados", () => {
    const c = countInventory(metricsFixture());
    expect(c.productCount).toBe(120);
    expect(c.belowMinCount).toBe(3);
    expect(c.outOfStockCount).toBe(2); // saldo 0 e negativo
    expect(c.negativeCount).toBe(1);
    expect(c.nearMinCount).toBe(1); // caderno 11 <= 10 * 1.2
    expect(c.stagnantCount).toBe(1);
    expect(c.stagnantValue).toBe(120);
    expect(c.aboveMaxKnown).toBe(false);
  });

  it("marca valor parado como indisponível sem custo", () => {
    const c = countInventory(
      metricsFixture({ stagnant: [{ id: "x", name: "Sem custo", stock: 5 }] }),
    );
    expect(c.stagnantValue).toBeNull();
  });

  it("conta acima do máximo apenas quando configurado", () => {
    const c = countInventory(
      metricsFixture({
        stagnant: [{ id: "x", name: "Excesso", stock: 90, max_stock: 50, cost: 1 }],
      }),
    );
    expect(c.aboveMaxKnown).toBe(true);
    expect(c.aboveMaxCount).toBe(1);
  });

  it("resolve última movimentação e entradas", () => {
    const rows = [
      movement(),
      movement({ id: "m2", type: "in", movement_date: "2026-02-10T08:00:00.000Z" }),
    ];
    expect(lastMovementAt(rows)).toBe("2026-02-10T08:00:00.000Z");
    expect(countInbound(rows)).toBe(1);
    expect(lastMovementAt([])).toBeNull();
  });
});

describe("accounting-ai · estoque · resumo", () => {
  it("gera os 10 indicadores mesmo sem métricas", () => {
    const metrics = buildInventoryMetrics(null);
    expect(metrics).toHaveLength(10);
    expect(metrics.every((m) => m.available === false)).toBe(true);
    expect(formatInventoryMetric(metrics[0]!)).toBe("—");
  });

  it("formata contagem e moeda", () => {
    const metrics = buildInventoryMetrics(metricsFixture());
    const capital = metrics.find((m) => m.id === "capital_estoque")!;
    expect(capital.available).toBe(true);
    expect(formatInventoryMetric(capital)).toContain("82.000");
    const ativos = metrics.find((m) => m.id === "produtos_ativos")!;
    expect(formatInventoryMetric(ativos)).toBe("120");
  });

  it("monta detalhes de última movimentação e item crítico", async () => {
    const summary = await makeSummary();
    const details = buildInventoryDetails({
      metrics: metricsFixture(),
      movements: [movement()],
      summary,
    });
    const last = details.find((d) => d.id === "ultima_movimentacao")!;
    expect(last.available).toBe(true);
    const critical = details.find((d) => d.id === "produto_mais_critico")!;
    expect(critical.value).toBe("Borracha");
    expect(critical.link.href).toBe("/estoque/produto/p3");
  });
});

describe("accounting-ai · estoque · alertas", () => {
  it("emite ruptura, negativo, abaixo do mínimo e parados", () => {
    const alerts = buildInventoryAlerts(
      { metrics: metricsFixture(), movements: [movement()] },
      { alertLimit: 20, now: NOW },
    );
    const ids = alerts.map((a) => a.id);
    expect(ids).toContain("produto_negativo");
    expect(ids).toContain("produto_ruptura");
    expect(ids).toContain("estoque_critico");
    expect(ids).toContain("proximo_minimo");
    expect(ids).toContain("produto_parado");
    expect(ids).toContain("produto_sem_compra");
    expect(alerts[0]!.severity).toBe("critical");
  });

  it("não emite alertas de estoque sem métricas", () => {
    expect(buildInventoryAlerts({}, { now: NOW })).toHaveLength(0);
  });

  it("agrega notificações proativas de estoque/produtos e ignora as demais", () => {
    const alerts = buildInventoryAlerts(
      {
        metrics: metricsFixture(),
        notifications: [notification(), notification({ id: "n2", category: "fiscal" })],
      },
      { alertLimit: 20, now: NOW },
    );
    const proactive = alerts.filter((a) => a.source === "proactive");
    expect(proactive).toHaveLength(1);
    expect(proactive[0]!.link).toBe(BELLA_INVENTORY_LINKS.abrir_compras);
  });

  it("respeita o limite de alertas", () => {
    const alerts = buildInventoryAlerts({ metrics: metricsFixture() }, { alertLimit: 2 });
    expect(alerts).toHaveLength(2);
  });
});

describe("accounting-ai · estoque · filtros e recomendações", () => {
  it("reconhece apenas categorias de estoque/produtos", () => {
    expect(INVENTORY_CATEGORIES).toEqual(["estoque", "produtos"]);
    expect(isInventoryCategory("estoque")).toBe(true);
    expect(isInventoryCategory("caixa")).toBe(false);
    expect(filterInventoryInsights([insight(), insight({ id: "i2", category: "caixa" })])).toHaveLength(1);
    expect(
      filterInventoryNotifications([notification(), notification({ id: "n3", category: "caixa" })]),
    ).toHaveLength(1);
  });

  it("converte insights em recomendações navegáveis", () => {
    const recs = buildInventoryRecommendations([insight(), insight({ id: "i2", category: "caixa" })]);
    expect(recs).toHaveLength(1);
    expect(recs[0]!.link).toBe(BELLA_INVENTORY_LINKS.abrir_compras);
  });
});

describe("accounting-ai · estoque · view", () => {
  it("fica indisponível sem nenhuma fonte", () => {
    const view = buildBellaInventoryView({}, { now: NOW });
    expect(view.available).toBe(false);
    expect(view.missing).toContain("métricas de estoque");
    expect(view.health).toBeNull();
  });

  it("monta a view completa com resumo contábil", async () => {
    const summary = await makeSummary();
    const view = buildBellaInventoryView(
      { summary, metrics: metricsFixture(), movements: [movement()] },
      { now: NOW },
    );
    expect(view.available).toBe(true);
    expect(view.missing).toHaveLength(0);
    expect(view.metrics).toHaveLength(10);
    expect(view.details).toHaveLength(4);
    expect(view.alerts.length).toBeGreaterThan(0);
    expect(buildInventoryHealth(summary)).not.toBeNull();
  });
});

describe("accounting-ai · estoque · chat", () => {
  it("detecta a intenção de estoque nas perguntas do operador", () => {
    for (const q of [
      "Como está meu estoque?",
      "O que preciso comprar?",
      "Quais produtos estão parados?",
      "O que está acabando?",
    ]) {
      expect(detectIntent(q).intent).toBe("situacao_estoque");
    }
  });

  it("mantém a pergunta de produtos mais vendidos no ranking existente", () => {
    expect(detectIntent("Qual produto mais vendido?").intent).toBe("consultar_produtos");
  });

  it("planeja apenas skills já existentes", () => {
    const plan = planIntent(detectIntent("Como está meu estoque?"));
    expect(plan.shape).toBe("composite");
    expect(plan.steps.map((s) => s.skillId)).toEqual([
      "consultar_produtos",
      "consultar_alertas",
      "consultar_recomendacoes",
      "consultar_notificacoes",
    ]);
  });
});
