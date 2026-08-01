import { describe, expect, it } from "vitest";
import {
  BELLA_PURCHASES_LINKS,
  BELLA_PURCHASES_LINK_ORDER,
  PURCHASES_CATEGORIES,
  biggestPurchase,
  buildBellaPurchasesView,
  buildPurchasesAlerts,
  buildPurchasesDetails,
  buildPurchasesHealth,
  buildPurchasesMetrics,
  buildPurchasesRecommendations,
  countPurchases,
  filterPurchasesInsights,
  filterPurchasesNotifications,
  formatPurchasesMetric,
  isPurchasesCategory,
  latestPurchase,
  purchaseOrderLink,
  purchaseProductLink,
  purchaseSupplierLink,
  purchasesLink,
  purchasesLinkForAction,
  purchasesLinks,
  suppliersWithoutOrders,
  topSupplier,
  type BellaPurchaseOrderLike,
  type BellaPurchasesInput,
  type BellaPurchasesInventoryLike,
  type BellaPurchasesMetricsLike,
} from "../purchases";
import { detectIntent, planIntent } from "../chat";
import type { BellaNotification } from "../proactive";
import type { AccountingInsight } from "../insights";
import { makeSummary } from "./fixtures";

const NOW = "2026-02-10T12:00:00.000Z";

function orders(over: BellaPurchaseOrderLike[] = []): BellaPurchaseOrderLike[] {
  return [
    {
      id: "p1",
      number: "C-001",
      status: "pending",
      grand_total: 1000,
      purchase_date: "2026-02-10",
      expected_delivery_date: "2026-02-05",
      supplier_id: "s1",
      supplier_name: "Fornecedor A",
    },
    {
      id: "p2",
      number: "C-002",
      status: "received",
      grand_total: 400,
      purchase_date: "2026-02-01",
      received_at: "2026-02-03",
      supplier_id: "s1",
      supplier_name: "Fornecedor A",
    },
    {
      id: "p3",
      number: "C-003",
      status: "cancelled",
      grand_total: 9999,
      purchase_date: "2026-01-20",
      supplier_id: "s2",
      supplier_name: "Fornecedor B",
    },
    {
      id: "p4",
      number: "C-004",
      status: "received",
      grand_total: 200,
      purchase_date: "2026-01-15",
      supplier_id: "s2",
      supplier_name: "Fornecedor B",
    },
    ...over,
  ];
}

const metricsFixture: BellaPurchasesMetricsLike = {
  monthCount: 2,
  monthTotal: 1400,
  pending: 1,
  activeSuppliers: 2,
};

const inventoryFixture: BellaPurchasesInventoryLike = {
  productCount: 30,
  inventoryValue: 1000,
  belowMin: [
    { id: "prod1", name: "Café 500g", sku: "CAF", stock: 0, min_stock: 10 },
    { id: "prod2", name: "Açúcar", sku: "ACU", stock: 3, min_stock: 8 },
  ],
  stagnant: [],
};

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

function notification(over: Partial<BellaNotification> = {}): BellaNotification {
  return {
    id: "n1",
    category: "estoque",
    severity: "critical",
    title: "Ruptura iminente",
    message: "Produto sem saldo",
    recommendation: "Compre agora",
    action: { id: "comprar_estoque", label: "Comprar estoque" },
    priority: 90,
    createdAt: NOW,
    dismissible: true,
    persistent: false,
    ...over,
  };
}

const baseInput = (over: Partial<BellaPurchasesInput> = {}): BellaPurchasesInput => ({
  orders: orders(),
  metrics: metricsFixture,
  inventory: inventoryFixture,
  suppliers: [
    { id: "s1", name: "Fornecedor A" },
    { id: "s2", name: "Fornecedor B" },
    { id: "s3", name: "Fornecedor C" },
  ],
  ...over,
});

describe("accounting-ai · compras · links", () => {
  it("expõe destinos existentes e só navega", () => {
    expect(purchasesLinks()).toHaveLength(BELLA_PURCHASES_LINK_ORDER.length);
    for (const link of purchasesLinks()) {
      expect(link.href.startsWith("/")).toBe(true);
    }
    expect(purchasesLink("abrir_compras").href).toBe("/compras");
    expect(purchasesLink("nova_compra").href).toBe("/compras/novo");
    expect(purchasesLink("abrir_fornecedores").href).toBe("/fornecedores");
    expect(purchasesLink("abrir_estoque").href).toBe("/estoque");
  });

  it("mapeia ações de insight/notificação para navegação de compras", () => {
    expect(purchasesLinkForAction({ id: "comprar_estoque" })).toBe(
      BELLA_PURCHASES_LINKS.abrir_compras,
    );
    expect(purchasesLinkForAction({ id: "negociar_prazos" })).toBe(
      BELLA_PURCHASES_LINKS.abrir_fornecedores,
    );
    expect(purchasesLinkForAction(null)).toBe(BELLA_PURCHASES_LINKS.abrir_compras);
  });

  it("aponta pedido, fornecedor e produto quando existem", () => {
    expect(purchaseOrderLink("p1").href).toBe("/compras/p1/editar");
    expect(purchaseSupplierLink("s1").href).toBe("/fornecedores/s1");
    expect(purchaseProductLink("prod1").href).toBe("/estoque/produto/prod1");
  });
});

describe("accounting-ai · compras · contagens", () => {
  it("conta hoje, pendentes, recebidos e atrasados ignorando cancelados", () => {
    const c = countPurchases(orders(), { now: NOW });
    expect(c.todayCount).toBe(1);
    expect(c.todayTotal).toBe(1000);
    expect(c.pendingCount).toBe(1);
    expect(c.receivedCount).toBe(2);
    expect(c.lateCount).toBe(1);
    expect(c.cancelledCount).toBe(1);
    expect(c.totalCount).toBe(3);
    expect(c.totalValue).toBe(1600);
    expect(c.averageOrder).toBeCloseTo(1600 / 3, 5);
    expect(c.supplierIds.sort()).toEqual(["s1", "s2"]);
  });

  it("não inventa números sem pedidos", () => {
    const c = countPurchases(null, { now: NOW });
    expect(c.totalCount).toBe(0);
    expect(c.averageOrder).toBeNull();
    expect(c.supplierIds).toEqual([]);
  });

  it("identifica maior compra, última compra e fornecedor principal", () => {
    expect(biggestPurchase(orders())?.id).toBe("p1");
    expect(latestPurchase(orders())?.id).toBe("p1");
    const top = topSupplier(orders());
    expect(top?.id).toBe("s1");
    expect(top?.total).toBe(1400);
    expect(top?.count).toBe(2);
  });

  it("lista fornecedores cadastrados sem pedidos", () => {
    expect(suppliersWithoutOrders(baseInput()).map((s) => s.id)).toEqual(["s3"]);
  });
});

describe("accounting-ai · compras · resumo", () => {
  it("expõe os indicadores previstos", () => {
    const metrics = buildPurchasesMetrics(baseInput(), { now: NOW });
    expect(metrics.map((m) => m.id)).toEqual([
      "compras_hoje",
      "compras_mes",
      "pedidos_pendentes",
      "pedidos_recebidos",
      "pedidos_atrasados",
      "fornecedores_ativos",
      "fornecedores_inativos",
      "aguardando_reposicao",
    ]);
    const by = Object.fromEntries(metrics.map((m) => [m.id, m]));
    expect(by.compras_hoje.value).toBe(1000);
    expect(by.compras_mes.value).toBe(1400);
    expect(by.pedidos_pendentes.value).toBe(1);
    expect(by.pedidos_recebidos.value).toBe(2);
    expect(by.pedidos_atrasados.value).toBe(1);
    expect(by.fornecedores_ativos.value).toBe(2);
    expect(by.fornecedores_inativos.value).toBe(1);
    expect(by.aguardando_reposicao.value).toBe(2);
  });

  it("marca indisponível sem dados e formata com travessão", () => {
    const metrics = buildPurchasesMetrics({}, { now: NOW });
    expect(metrics.every((m) => m.available === false)).toBe(true);
    expect(formatPurchasesMetric(metrics[0])).toBe("—");
  });

  it("formata moeda e quantidade", () => {
    const metrics = buildPurchasesMetrics(baseInput(), { now: NOW });
    const money = metrics.find((m) => m.id === "compras_hoje")!;
    const count = metrics.find((m) => m.id === "pedidos_pendentes")!;
    expect(formatPurchasesMetric(money)).toContain("1.000");
    expect(formatPurchasesMetric(count)).toBe("1");
  });

  it("monta detalhes com maior compra, última compra e reposição urgente", () => {
    const details = buildPurchasesDetails(baseInput());
    const by = Object.fromEntries(details.map((d) => [d.id, d]));
    expect(by.maior_compra.available).toBe(true);
    expect(by.maior_compra.link.href).toBe("/compras/p1/editar");
    expect(by.ultima_compra.hint).toBe("2026-02-10");
    expect(by.fornecedor_principal.value).toBe("Fornecedor A");
    expect(by.reposicao_urgente.value).toBe("Café 500g");
    expect(by.reposicao_urgente.link.href).toBe("/estoque/produto/prod1");
  });

  it("não expõe detalhes sem dados", () => {
    const details = buildPurchasesDetails({});
    expect(details.every((d) => d.available === false)).toBe(true);
  });
});

describe("accounting-ai · compras · alertas", () => {
  it("gera alertas dos estados já registrados", () => {
    const alerts = buildPurchasesAlerts(baseInput(), { now: NOW, alertLimit: 10 });
    const ids = alerts.map((a) => a.id);
    expect(ids).toContain("pedidos_atrasados");
    expect(ids).toContain("produtos_sem_reposicao");
    expect(ids).toContain("reposicao_urgente");
    expect(ids).toContain("fornecedor_sem_pedidos");
    expect(ids).toContain("capital_elevado_compras");
    expect(ids).toContain("aguardando_recebimento");
    expect(alerts.every((a) => a.link.href.startsWith("/"))).toBe(true);
    expect(alerts[0].severity).toBe("critical");
  });

  it("alerta compra acima da média", () => {
    const input = baseInput({
      orders: [
        { id: "a", number: "C-A", status: "received", grand_total: 100, purchase_date: "2026-02-01" },
        { id: "b", number: "C-B", status: "received", grand_total: 100, purchase_date: "2026-02-02" },
        { id: "c", number: "C-C", status: "received", grand_total: 5000, purchase_date: "2026-02-03" },
      ],
    });
    const ids = buildPurchasesAlerts(input, { now: NOW, alertLimit: 10 }).map((a) => a.id);
    expect(ids).toContain("compra_acima_da_media");
  });

  it("alerta ausência de fornecedor ativo", () => {
    const ids = buildPurchasesAlerts(baseInput({ suppliers: [] }), {
      now: NOW,
      alertLimit: 10,
    }).map((a) => a.id);
    expect(ids).toContain("fornecedor_inativo");
  });

  it("incorpora notificações proativas de compras e respeita o limite", () => {
    const alerts = buildPurchasesAlerts(
      baseInput({ notifications: [notification(), notification({ id: "n2", category: "caixa" })] }),
      { now: NOW, alertLimit: 3 },
    );
    expect(alerts).toHaveLength(3);
    expect(alerts.some((a) => a.source === "proactive")).toBe(true);
    expect(alerts.some((a) => a.id === "n2")).toBe(false);
  });

  it("não gera alertas sem dados", () => {
    expect(buildPurchasesAlerts({}, { now: NOW })).toEqual([]);
  });
});

describe("accounting-ai · compras · recomendações", () => {
  it("reaproveita apenas insights de categorias de compras", () => {
    const recs = buildPurchasesRecommendations([
      insight(),
      insight({ id: "i2", category: "caixa" }),
      insight({ id: "i3", category: "produtos", priority: 90 }),
    ]);
    expect(recs.map((r) => r.id)).toEqual(["i3", "i1"]);
    expect(recs[0].link.href.startsWith("/")).toBe(true);
  });

  it("respeita o limite e o vazio", () => {
    expect(buildPurchasesRecommendations([insight()], 0)).toEqual([]);
    expect(buildPurchasesRecommendations([])).toEqual([]);
  });

  it("classifica categorias de compras", () => {
    expect(PURCHASES_CATEGORIES).toEqual(["estoque", "produtos"]);
    expect(isPurchasesCategory("estoque")).toBe(true);
    expect(isPurchasesCategory("caixa")).toBe(false);
    expect(filterPurchasesInsights([insight({ category: "caixa" })])).toEqual([]);
    expect(filterPurchasesNotifications([notification({ category: "fiscal" })])).toEqual([]);
  });
});

describe("accounting-ai · compras · view", () => {
  it("monta o view model completo", async () => {
    const summary = await makeSummary();
    const view = buildBellaPurchasesView(baseInput({ summary }), { now: NOW });
    expect(view.available).toBe(true);
    expect(view.generatedAt).toBe(NOW);
    expect(view.metrics).toHaveLength(8);
    expect(view.details).toHaveLength(4);
    expect(view.missing).toHaveLength(0);
    expect(view.alerts.length).toBeGreaterThan(0);
    expect(buildPurchasesHealth(summary)?.score).toBe(
      summary.health.available ? summary.health.data!.score : undefined,
    );
  });

  it("degrada com elegância sem nenhum dado", () => {
    const view = buildBellaPurchasesView({}, { now: NOW });
    expect(view.available).toBe(false);
    expect(view.alerts).toEqual([]);
    expect(view.recommendations).toEqual([]);
    expect(view.health).toBeNull();
    expect(view.missing).toEqual([
      "pedidos de compra",
      "métricas de compras",
      "métricas de estoque",
      "resumo contábil",
    ]);
  });
});

describe("accounting-ai · compras · chat", () => {
  it("reconhece perguntas de compras", () => {
    for (const q of [
      "Como estão minhas compras?",
      "Tenho pedidos atrasados?",
      "Qual fornecedor compra mais?",
      "Quais produtos precisam de reposição?",
    ]) {
      expect(detectIntent(q).intent).toBe("situacao_compras");
    }
  });

  it("mantém a reposição de estoque na intenção existente", () => {
    expect(detectIntent("O que preciso comprar?").intent).toBe("situacao_estoque");
  });

  it("planeja apenas skills já existentes", () => {
    const plan = planIntent(detectIntent("como estão minhas compras?"));
    expect(plan.intent).toBe("situacao_compras");
    expect(plan.steps.map((s) => s.skillId)).toEqual([
      "consultar_produtos",
      "consultar_alertas",
      "consultar_recomendacoes",
      "consultar_notificacoes",
    ]);
  });
});
