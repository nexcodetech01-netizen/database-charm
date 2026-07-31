import { describe, expect, it } from "vitest";
import {
  BELLA_FINANCE_LINKS,
  BELLA_FINANCE_LINK_ORDER,
  FINANCE_CATEGORIES,
  buildBellaFinanceView,
  buildFinanceDetails,
  buildFinanceHealth,
  buildFinanceMetrics,
  buildFinanceRecommendations,
  filterFinanceInsights,
  filterFinanceNotifications,
  financeLink,
  financeLinkForAction,
  financeLinks,
  isFinanceCategory,
} from "../finance";
import { buildAccountingInsights, type AccountingInsight } from "../insights";
import { buildFinancialAdvice } from "../advisor";
import { buildBellaNotifications, makeNotification, type BellaNotification } from "../proactive";
import { detectIntent } from "../chat";
import { makeSummary } from "./fixtures";
import type { AccountingSummary } from "../types";

const NOW = "2026-01-20T12:00:00.000Z";

function insight(over: Partial<AccountingInsight> = {}): AccountingInsight {
  return {
    id: "i1",
    severity: "warning",
    category: "caixa",
    title: "Caixa apertado",
    description: "Cobertura baixa",
    recommendation: "Revisar contas",
    priority: 70,
    action: { id: "negociar_prazos", label: "Negociar prazos" },
    sourceProvider: "cash",
    createdAt: NOW,
    ...over,
  };
}

function notification(
  over: Partial<Parameters<typeof makeNotification>[0]> = {},
): BellaNotification {
  return makeNotification({
    id: "n1",
    category: "caixa",
    severity: "critical",
    title: "Caixa crítico",
    message: "Saldo abaixo do necessário",
    recommendation: "Priorize recebimentos",
    action: "cobrar_cliente",
    createdAt: NOW,
    ...over,
  });
}

describe("accounting-ai · finance · links", () => {
  it("expõe os 8 destinos de navegação previstos", () => {
    expect(BELLA_FINANCE_LINK_ORDER).toHaveLength(8);
    expect(financeLinks().map((l) => l.id)).toEqual(BELLA_FINANCE_LINK_ORDER);
    for (const link of financeLinks()) {
      expect(link.href.startsWith("/")).toBe(true);
      expect(link.label.length).toBeGreaterThan(0);
    }
  });

  it("resolve link por id", () => {
    expect(financeLink("ver_caixa")).toEqual(BELLA_FINANCE_LINKS.ver_caixa);
    expect(financeLink("ver_fluxo").href).toContain("cashflow");
  });

  it("mapeia ações sugeridas para destinos de navegação", () => {
    expect(financeLinkForAction("cobrar_cliente").id).toBe("abrir_contas");
    expect(financeLinkForAction("revisar_retirada").id).toBe("ver_caixa");
    expect(financeLinkForAction("comprar_estoque").id).toBe("abrir_produtos");
    expect(financeLinkForAction("programar_imposto").id).toBe("ver_contas");
    // desconhecido cai no fallback seguro
    expect(financeLinkForAction("acao_inexistente").id).toBe("abrir_financeiro");
  });
});

describe("accounting-ai · finance · filtro financeiro", () => {
  it("aceita apenas as categorias financeiras", () => {
    expect(FINANCE_CATEGORIES).toEqual(["financeiro", "caixa", "fiscal", "receita", "lucro"]);
    expect(isFinanceCategory("caixa")).toBe(true);
    expect(isFinanceCategory("estoque")).toBe(false);
    expect(isFinanceCategory("clientes")).toBe(false);
  });

  it("filtra notificações não financeiras", () => {
    const list = [
      notification({ id: "n1", category: "caixa" }),
      notification({ id: "n2", category: "estoque", severity: "warning" }),
      notification({ id: "n3", category: "fiscal", severity: "warning" }),
      notification({ id: "n4", category: "clientes", severity: "info" }),
    ];
    const filtered = filterFinanceNotifications(list);
    expect(filtered.map((n) => n.id)).toEqual(["n1", "n3"]);
    // ordenação preservada: crítico primeiro
    expect(filtered[0]!.severity).toBe("critical");
  });

  it("filtra insights não financeiros", () => {
    const list = [
      insight({ id: "i1", category: "caixa" }),
      insight({ id: "i2", category: "produtos" }),
      insight({ id: "i3", category: "receita", severity: "critical", priority: 95 }),
    ];
    const filtered = filterFinanceInsights(list);
    expect(filtered.map((i) => i.id)).toEqual(["i3", "i1"]);
  });
});

describe("accounting-ai · finance · resumo", () => {
  let summary: AccountingSummary;

  it("monta indicadores a partir do summary e do advisor", async () => {
    summary = await makeSummary();
    const advice = buildFinancialAdvice({ summary });
    const metrics = buildFinanceMetrics(summary, advice);

    expect(metrics.map((m) => m.id)).toEqual([
      "receita",
      "lucro",
      "caixa",
      "a_pagar",
      "a_receber",
      "retirada_segura",
    ]);
    expect(metrics.every((m) => m.link.href.startsWith("/"))).toBe(true);
    expect(metrics.find((m) => m.id === "receita")!.value).toBe(
      summary.revenue.data!.netRevenue,
    );
    expect(metrics.find((m) => m.id === "caixa")!.value).toBe(
      summary.cash.data!.currentBalance,
    );
    expect(metrics.find((m) => m.id === "retirada_segura")!.value).toBe(
      advice.available ? advice.withdrawal.safeAmount : null,
    );
  });

  it("monta detalhes financeiros sem recalcular nada", async () => {
    summary = await makeSummary();
    const advice = buildFinancialAdvice({ summary });
    const details = buildFinanceDetails(summary, advice);

    expect(details.map((d) => d.id)).toEqual([
      "contas_vencendo",
      "contas_atraso",
      "recebimentos_previstos",
      "pagamentos_previstos",
      "prolabore_sugerido",
    ]);
    expect(details.find((d) => d.id === "contas_vencendo")!.value).toBe(
      summary.cash.data!.payable,
    );
    expect(details.find((d) => d.id === "contas_atraso")!.value).toBe(
      summary.cash.data!.receivableOverdue,
    );
    expect(details.find((d) => d.id === "recebimentos_previstos")!.value).toBe(
      summary.cashFlow.data!.incoming,
    );
  });

  it("marca indisponível quando não há summary", () => {
    const metrics = buildFinanceMetrics(null, null);
    const details = buildFinanceDetails(null, null);
    expect(metrics.every((m) => !m.available && m.value === null)).toBe(true);
    expect(details.every((d) => !d.available && d.value === null)).toBe(true);
    expect(buildFinanceHealth(null)).toBeNull();
  });

  it("expõe saúde financeira já apurada", async () => {
    summary = await makeSummary();
    const health = buildFinanceHealth(summary);
    expect(health).not.toBeNull();
    expect(health!.score).toBe(summary.health.data!.score);
    expect(health!.label.length).toBeGreaterThan(0);
  });
});

describe("accounting-ai · finance · recomendações", () => {
  it("converte insights financeiros em recomendações navegáveis", () => {
    const list = [
      insight({ id: "i1", category: "caixa", action: { id: "negociar_prazos", label: "x" } }),
      insight({ id: "i2", category: "estoque" }),
      insight({
        id: "i3",
        category: "financeiro",
        severity: "critical",
        priority: 95,
        action: { id: "cobrar_cliente", label: "y" },
      }),
    ];
    const recs = buildFinanceRecommendations(list);
    expect(recs.map((r) => r.id)).toEqual(["i3", "i1"]);
    expect(recs[0]!.link.id).toBe("abrir_contas");
    expect(recs[1]!.link.id).toBe("ver_contas");
  });

  it("respeita o limite informado", () => {
    const list = Array.from({ length: 9 }, (_, i) =>
      insight({ id: `i${i}`, category: "caixa", priority: 90 - i }),
    );
    expect(buildFinanceRecommendations(list, 3)).toHaveLength(3);
    expect(buildFinanceRecommendations(list, 0)).toHaveLength(0);
  });
});

describe("accounting-ai · finance · view do painel", () => {
  it("constrói o view model completo reutilizando os motores existentes", async () => {
    const summary = await makeSummary();
    const insights = buildAccountingInsights(summary);
    const advice = buildFinancialAdvice({ summary });
    const notifications = buildBellaNotifications({ summary, insights, advice });

    const view = buildBellaFinanceView(
      { summary, insights, advice, notifications },
      { now: NOW },
    );

    expect(view.available).toBe(true);
    expect(view.generatedAt).toBe(NOW);
    expect(view.metrics).toHaveLength(6);
    expect(view.details).toHaveLength(5);
    expect(view.advice).toBe(advice);
    expect(view.alerts.length).toBeLessThanOrEqual(5);
    expect(view.alerts.every((a) => isFinanceCategory(a.category))).toBe(true);
    expect(view.recommendations.every((r) => isFinanceCategory(r.category))).toBe(true);
  });

  it("deriva insights/advisor/notificações quando não recebidos", async () => {
    const summary = await makeSummary();
    const view = buildBellaFinanceView({ summary });
    expect(view.available).toBe(true);
    expect(view.advice).not.toBeNull();
    expect(Array.isArray(view.alerts)).toBe(true);
  });

  it("degrada com segurança sem summary", () => {
    const view = buildBellaFinanceView({}, { now: NOW });
    expect(view.available).toBe(false);
    expect(view.alerts).toEqual([]);
    expect(view.recommendations).toEqual([]);
    expect(view.missing).toContain("resumo financeiro");
  });

  it("respeita limites de alertas e recomendações", async () => {
    const summary = await makeSummary();
    const view = buildBellaFinanceView({ summary }, { alertLimit: 2, recommendationLimit: 1 });
    expect(view.alerts.length).toBeLessThanOrEqual(2);
    expect(view.recommendations.length).toBeLessThanOrEqual(1);
  });
});

describe("accounting-ai · finance · chat", () => {
  it("mantém o chat existente respondendo perguntas financeiras", () => {
    expect(detectIntent("posso retirar dinheiro?").intent).not.toBe("desconhecido");
    expect(detectIntent("como está o caixa?").intent).not.toBe("desconhecido");
  });
});
