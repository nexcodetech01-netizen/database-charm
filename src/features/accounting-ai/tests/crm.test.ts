import { describe, expect, it } from "vitest";
import {
  BELLA_CRM_LINKS,
  BELLA_CRM_LINK_ORDER,
  CRM_CATEGORIES,
  buildBellaCrmView,
  buildCrmAlerts,
  buildCrmDetails,
  buildCrmHealth,
  buildCrmMetrics,
  buildCrmRecommendations,
  countCrm,
  crmCustomerHistoryLink,
  crmCustomerLink,
  crmDay,
  crmLink,
  crmLinkForAction,
  crmLinks,
  crmSaleLink,
  customersWithoutContact,
  filterCrmInsights,
  filterCrmNotifications,
  formatCrmMetric,
  isCrmCategory,
  latestCustomer,
  latestCustomerSale,
  topBuyer,
  topRevenueCustomer,
  topTicketCustomer,
  type BellaCrmCustomerLike,
  type BellaCrmInput,
  type BellaCrmMetricsLike,
  type BellaCrmReportLike,
  type BellaCrmSaleLike,
} from "../crm";
import { detectIntent, planIntent } from "../chat";
import type { BellaNotification } from "../proactive";
import type { AccountingInsight } from "../insights";
import { makeSummary } from "./fixtures";

const NOW = "2026-02-10T12:00:00.000Z";

const metrics: BellaCrmMetricsLike = {
  total: 100,
  active: 40,
  newThisMonth: 6,
  inactive90: 12,
};

const report: BellaCrmReportLike = {
  metrics: { total: 100, active: 40, newInRange: 6, recurring: 18, inactive: 25 },
  topCustomers: [
    { id: "c1", name: "Cliente A", purchases: 10, revenue: 5000 },
    { id: "c2", name: "Cliente B", purchases: 2, revenue: 4000 },
    { id: "c3", name: "Cliente C", purchases: 4, revenue: 1000 },
  ],
};

function customers(): BellaCrmCustomerLike[] {
  return [
    { id: "c1", name: "Cliente A", created_at: "2026-01-02", last_interaction_at: "2026-02-09" },
    { id: "c9", name: "Cliente Novo", created_at: "2026-02-08", last_interaction_at: "2026-02-08" },
    { id: "c4", name: "Cliente Frio", created_at: "2025-05-01", last_interaction_at: "2025-06-01" },
  ];
}

function sales(): BellaCrmSaleLike[] {
  return [
    {
      id: "s1",
      number: "V-1",
      customer_id: "c1",
      customer_name: "Cliente A",
      grand_total: 900,
      sale_date: "2026-02-09",
      status: "completed",
    },
    {
      id: "s2",
      customer_id: "c2",
      customer_name: "Cliente B",
      grand_total: 5000,
      sale_date: "2026-02-10",
      status: "cancelled",
    },
    { id: "s3", grand_total: 100, sale_date: "2026-02-10", status: "completed" },
  ];
}

function input(over: Partial<BellaCrmInput> = {}): BellaCrmInput {
  return {
    summary: makeSummary(),
    metrics,
    report,
    customers: customers(),
    sales: sales(),
    ...over,
  };
}

describe("Bella CRM — links", () => {
  it("expõe apenas rotas existentes do NexOS", () => {
    for (const id of BELLA_CRM_LINK_ORDER) {
      expect(BELLA_CRM_LINKS[id].href.startsWith("/")).toBe(true);
    }
    expect(crmLinks()).toHaveLength(BELLA_CRM_LINK_ORDER.length);
    expect(crmLink("abrir_clientes").id).toBe("abrir_clientes");
  });

  it("monta links de detalhe de cliente, histórico e venda", () => {
    expect(crmCustomerLink("c1").href).toContain("c1");
    expect(crmCustomerHistoryLink("c1").href).toContain("c1");
    expect(crmSaleLink("s1").href).toContain("s1");
  });

  it("mapeia ações de insight/notificação para navegação", () => {
    expect(crmLinkForAction({ id: "reativar_cliente" }).id).toBe("abrir_clientes");
    expect(crmLinkForAction(null).id).toBe("abrir_clientes");
  });
});

describe("Bella CRM — leitura de dados já apurados", () => {
  it("conta a base sem recalcular métricas", () => {
    const c = countCrm(input());
    expect(c.total).toBe(100);
    expect(c.active).toBe(40);
    expect(c.recurring).toBe(18);
    expect(c.inactive).toBe(25);
    expect(c.withoutPurchases).toBe(60);
    expect(c.recoverable).toBe(25);
    expect(c.recurringRatio).toBeCloseTo(0.45);
  });

  it("cai para customersService.metrics quando não há relatório", () => {
    const c = countCrm(input({ report: null, summary: null }));
    expect(c.total).toBe(100);
    expect(c.newCustomers).toBe(6);
    expect(c.inactive).toBe(12);
  });

  it("marca base ausente quando nada foi carregado", () => {
    const c = countCrm({ metrics: null, report: null, summary: null });
    expect(c.hasBase).toBe(false);
    expect(c.recurringRatio).toBeNull();
  });

  it("identifica maior comprador, maior faturamento e maior ticket", () => {
    expect(topBuyer(input())?.id).toBe("c1");
    expect(topRevenueCustomer(input())?.id).toBe("c1");
    expect(topTicketCustomer(input())?.id).toBe("c2");
  });

  it("encontra último cadastro e última venda de cliente", () => {
    expect(latestCustomer(customers())?.id).toBe("c9");
    const sale = latestCustomerSale(sales());
    expect(sale?.id).toBe("s1");
  });

  it("lista clientes sem contato recente", () => {
    const cold = customersWithoutContact(customers(), { now: NOW, noContactDays: 60 });
    expect(cold.map((c) => c.id)).toEqual(["c4"]);
  });

  it("normaliza datas em dia", () => {
    expect(crmDay("2026-02-10T10:00:00Z")).toBe("2026-02-10");
    expect(crmDay("abc")).toBeNull();
    expect(crmDay(null)).toBeNull();
  });
});

describe("Bella CRM — métricas e detalhes", () => {
  it("gera oito indicadores disponíveis", () => {
    const list = buildCrmMetrics(input());
    expect(list).toHaveLength(8);
    expect(list.every((m) => m.available)).toBe(true);
    expect(list.find((m) => m.id === "clientes_ativos")?.value).toBe(40);
  });

  it("marca indisponível quando não há dados", () => {
    const list = buildCrmMetrics({ metrics: null, report: null, summary: null });
    expect(list.every((m) => !m.available)).toBe(true);
    expect(formatCrmMetric(list[0]!)).toBe("—");
  });

  it("formata contagem, moeda e percentual", () => {
    const list = buildCrmMetrics(input());
    expect(formatCrmMetric(list.find((m) => m.id === "clientes_ativos")!)).toContain("40");
    expect(formatCrmMetric(list.find((m) => m.id === "faturamento_clientes")!)).toContain("R$");
  });

  it("monta os cinco detalhes de relacionamento", () => {
    const details = buildCrmDetails(input());
    expect(details.map((d) => d.id)).toEqual([
      "maior_comprador",
      "maior_faturamento",
      "maior_ticket",
      "ultimo_cliente",
      "ultima_venda",
    ]);
    expect(details[0]?.value).toBe("Cliente A");
    expect(details[3]?.value).toBe("Cliente Novo");
  });

  it("mantém detalhes indisponíveis sem dados", () => {
    const details = buildCrmDetails({});
    expect(details.every((d) => !d.available)).toBe(true);
  });
});

describe("Bella CRM — alertas puros", () => {
  it("alerta clientes sem compras, inativos e perdidos", () => {
    const alerts = buildCrmAlerts(input(), { now: NOW, alertLimit: 20 });
    const ids = alerts.map((a) => a.id);
    expect(ids).toContain("clientes_sem_compras");
    expect(ids).toContain("clientes_inativos");
    expect(ids).toContain("clientes_perdidos");
  });

  it("alerta queda de recorrência abaixo do limite", () => {
    const low = buildCrmAlerts(
      input({ report: { ...report, metrics: { ...report.metrics, recurring: 2 } } }),
      { now: NOW, alertLimit: 20 },
    );
    expect(low.map((a) => a.id)).toContain("queda_recorrencia");
  });

  it("alerta cliente VIP concentrando receita e novos clientes", () => {
    const alerts = buildCrmAlerts(input(), { now: NOW, alertLimit: 20 });
    const ids = alerts.map((a) => a.id);
    expect(ids).toContain("clientes_vip");
    expect(ids).toContain("clientes_em_crescimento");
    expect(ids).toContain("clientes_sem_contato");
  });

  it("não gera alertas de base quando não há dados", () => {
    const alerts = buildCrmAlerts({}, { now: NOW });
    expect(alerts).toEqual([]);
  });

  it("ordena por severidade e respeita o limite", () => {
    const alerts = buildCrmAlerts(input(), { now: NOW, alertLimit: 3 });
    expect(alerts).toHaveLength(3);
    expect(alerts[0]?.severity).toBe("critical");
  });

  it("incorpora notificações proativas de clientes", () => {
    const notification: BellaNotification = {
      id: "n-crm",
      category: "clientes",
      severity: "warning",
      title: "Clientes parados",
      message: "Base parada",
      recommendation: "Reative",
      priority: 10,
      action: { id: "reativar_cliente", label: "Reativar" },
    } as BellaNotification;
    const alerts = buildCrmAlerts(input({ notifications: [notification] }), {
      now: NOW,
      alertLimit: 20,
    });
    expect(alerts.some((a) => a.source === "proactive")).toBe(true);
  });
});

describe("Bella CRM — filtros, recomendações e saúde", () => {
  it("reconhece categorias de relacionamento", () => {
    expect(CRM_CATEGORIES).toContain("clientes");
    expect(isCrmCategory("clientes")).toBe(true);
    expect(isCrmCategory("fiscal")).toBe(false);
    expect(filterCrmNotifications([])).toEqual([]);
    expect(filterCrmInsights([])).toEqual([]);
  });

  it("converte insights de clientes em recomendações navegáveis", () => {
    const insight = {
      id: "i1",
      category: "clientes",
      severity: "warning",
      title: "Clientes inativos",
      description: "Base parada",
      recommendation: "Reative",
      priority: 5,
      action: { id: "reativar_cliente", label: "Reativar" },
    } as AccountingInsight;
    const recs = buildCrmRecommendations([insight]);
    expect(recs).toHaveLength(1);
    expect(recs[0]?.link.href).toBeTruthy();
  });

  it("expõe a saúde já calculada pelo resumo contábil", () => {
    expect(buildCrmHealth(makeSummary())).not.toBeNull();
    expect(buildCrmHealth(null)).toBeNull();
  });
});

describe("Bella CRM — view model", () => {
  it("monta a visão completa com dados disponíveis", () => {
    const view = buildBellaCrmView(input(), { now: NOW });
    expect(view.available).toBe(true);
    expect(view.metrics).toHaveLength(8);
    expect(view.details).toHaveLength(5);
    expect(view.alerts.length).toBeGreaterThan(0);
    expect(view.missing).toEqual([]);
    expect(view.generatedAt).toBe(NOW);
  });

  it("relata fontes ausentes sem quebrar", () => {
    const view = buildBellaCrmView({}, { now: NOW });
    expect(view.available).toBe(false);
    expect(view.missing).toContain("relatório de clientes");
    expect(view.alerts).toEqual([]);
  });

  it("é determinístico para a mesma entrada", () => {
    const a = buildBellaCrmView(input(), { now: NOW });
    const b = buildBellaCrmView(input(), { now: NOW });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("Bella CRM — chat", () => {
  it.each([
    "Como estão meus clientes?",
    "Quem compra mais?",
    "Quem está parado?",
    "Quem devo recuperar?",
    "Quem gera mais faturamento?",
    "Quem tem maior ticket?",
  ])("detecta a intenção de CRM em %s", (question) => {
    expect(detectIntent(question).intent).toBe("situacao_crm");
  });

  it("planeja somente skills já existentes", () => {
    const plan = planIntent(detectIntent("Como estão meus clientes?"));
    expect(plan.intent).toBe("situacao_crm");
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.steps.map((s) => s.skillId)).toContain("consultar_clientes");
  });

  it("não confunde com estoque ou vendas", () => {
    expect(detectIntent("Como está meu estoque?").intent).toBe("situacao_estoque");
    expect(detectIntent("Como estão minhas vendas?").intent).toBe("situacao_vendas");
  });
});
