import { describe, expect, it, beforeEach } from "vitest";
import {
  CATEGORY_ORDER,
  PROACTIVE_REGISTRY,
  PROACTIVE_RULES,
  PROACTIVE_RULE_COUNT,
  SEVERITY_ORDER,
  actionLabel,
  bellaNotificationStore,
  buildBellaNotifications,
  buildProactiveContext,
  buildTopNotifications,
  categoryLabel,
  computePriority,
  countCritical,
  countCriticalNotifications,
  filterDismissed,
  filterNotifications,
  getProactiveRule,
  groupNotifications,
  listProactiveRuleIds,
  magnitudeScore,
  makeNotification,
  notificationBadge,
  notificationIcon,
  severityLabel,
  severityRank,
  sortNotifications,
  unavailableProviders,
  type BellaNotification,
} from "../proactive";
import { detectIntent, planIntent } from "../chat";
import { getAccountingSkill } from "../skills";
import { makeSummary, makeTestServices, testPeriod, testToday } from "./fixtures";

const NOW = "2026-01-20T12:00:00.000Z";

function notification(over: Partial<BellaNotification> = {}): BellaNotification {
  return makeNotification({
    id: "n1",
    category: "caixa",
    severity: "info",
    title: "T",
    message: "M",
    recommendation: "R",
    action: "acompanhar",
    createdAt: NOW,
    ...over,
  } as never);
}

describe("proactive · helpers", () => {
  it("ordena severidade critical → warning → success → info", () => {
    expect(SEVERITY_ORDER).toEqual(["critical", "warning", "success", "info"]);
    expect(severityRank("critical")).toBeLessThan(severityRank("info"));
    expect(severityRank("nope" as never)).toBe(SEVERITY_ORDER.length);
  });

  it("calcula magnitude e prioridade de forma determinística", () => {
    expect(magnitudeScore(null)).toBe(0);
    expect(magnitudeScore(Number.NaN)).toBe(0);
    expect(magnitudeScore(100)).toBe(10);
    expect(magnitudeScore(-20)).toBe(4);
    expect(computePriority("critical", 100)).toBe(100);
    expect(computePriority("info")).toBe(20);
  });

  it("expõe labels de categoria, severidade e ação", () => {
    for (const c of CATEGORY_ORDER) expect(categoryLabel(c).length).toBeGreaterThan(0);
    expect(severityLabel("warning")).toBe("Atenção");
    expect(actionLabel("comprar_estoque")).toBe("Comprar estoque");
  });

  it("gera badge e ícone coerentes com a severidade", () => {
    const critical = notification({ severity: "critical", category: "receita" });
    expect(notificationBadge(critical)).toBe(`Crítico · ${critical.priority}`);
    expect(notificationIcon(critical)).toBe("trending-down");
    expect(notificationIcon(notification({ severity: "critical", category: "estoque" }))).toBe("alert");
    expect(notificationIcon(notification({ severity: "success" }))).toBe("check");
    expect(notificationIcon(notification({ severity: "info", category: "clientes" }))).toBe("users");
  });

  it("marca críticas como persistentes e não dispensáveis", () => {
    const critical = notification({ id: "c", severity: "critical" });
    expect(critical.persistent).toBe(true);
    expect(critical.dismissible).toBe(false);
    const info = notification({ id: "i", severity: "info" });
    expect(info.persistent).toBe(false);
    expect(info.dismissible).toBe(true);
  });

  it("ordena, agrupa, filtra e conta", () => {
    const list = [
      notification({ id: "b", severity: "info" }),
      notification({ id: "a", severity: "critical", category: "estoque" }),
      notification({ id: "c", severity: "warning", category: "clientes" }),
    ];
    expect(sortNotifications(list).map((n) => n.id)).toEqual(["a", "c", "b"]);
    expect(groupNotifications(list).map((g) => g.category)).toEqual([
      "caixa",
      "estoque",
      "clientes",
    ]);
    expect(filterNotifications(list, { severity: "critical" })).toHaveLength(1);
    expect(filterNotifications(list, { category: ["clientes", "estoque"] })).toHaveLength(2);
    expect(countCritical(list)).toBe(1);
  });

  it("dismiss remove apenas notificações não persistentes", () => {
    const list = [
      notification({ id: "keep", severity: "critical" }),
      notification({ id: "drop", severity: "info" }),
    ];
    expect(filterDismissed(list, []).map((n) => n.id)).toEqual(["keep", "drop"]);
    expect(filterDismissed(list, ["drop", "keep"]).map((n) => n.id)).toEqual(["keep"]);
  });
});

describe("proactive · engine e regras", () => {
  it("sem summary não gera nada", () => {
    expect(buildBellaNotifications({ summary: null })).toEqual([]);
    expect(buildProactiveContext({ summary: null }, NOW)).toBeNull();
  });

  it("gera notificações a partir de dados reais do resumo", async () => {
    const summary = await makeSummary();
    const list = buildBellaNotifications({ summary }, { now: NOW });

    expect(list.length).toBeGreaterThan(0);
    expect(new Set(list.map((n) => n.id)).size).toBe(list.length);
    for (const n of list) {
      expect(n.createdAt).toBe(NOW);
      expect(n.recommendation.length).toBeGreaterThan(0);
      expect(n.action.label.length).toBeGreaterThan(0);
    }

    const ids = list.map((n) => n.id);
    expect(ids).toContain("estoque_baixo");
    expect(ids).toContain("produto_parado");
    expect(ids).toContain("cliente_destaque");
    expect(ids).toContain("cliente_inativo");
    expect(ids).toContain("conta_vencida");
  });

  it("mantém a ordenação crítica → atenção → positiva → informativa", async () => {
    const summary = await makeSummary();
    const list = buildBellaNotifications({ summary }, { now: NOW });
    const ranks = list.map((n) => severityRank(n.severity));
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it("aplica dismiss e limite", async () => {
    const summary = await makeSummary();
    const all = buildBellaNotifications({ summary }, { now: NOW });
    const dismissable = all.find((n) => n.dismissible)!;
    const after = buildBellaNotifications(
      { summary },
      { now: NOW, dismissedIds: [dismissable.id] },
    );
    expect(after.map((n) => n.id)).not.toContain(dismissable.id);
    expect(buildTopNotifications({ summary }, { now: NOW })).toHaveLength(
      Math.min(5, all.length),
    );
    expect(buildBellaNotifications({ summary }, { now: NOW, limit: 2 })).toHaveLength(2);
  });

  it("detecta receita em queda quando não há crescimento", async () => {
    const summary = await makeSummary();
    const trends = summary.trends.data!;
    const down = {
      ...summary,
      trends: {
        ...summary.trends,
        data: {
          ...trends,
          monthVsPreviousRevenue: {
            ...trends.monthVsPreviousRevenue,
            direction: "down" as const,
            deltaPercent: -40,
            hasHistory: true,
          },
        },
      },
    };
    const list = buildBellaNotifications({ summary: down }, { now: NOW });
    const item = list.find((n) => n.id === "receita_caindo");
    expect(item?.severity).toBe("critical");
    expect(list.some((n) => n.id === "receita_crescendo")).toBe(false);
  });

  it("gera alerta de sistema quando um provider fica indisponível", async () => {
    const summary = await makeSummary({ breakFinance: true });
    expect(unavailableProviders({ summary }).length).toBeGreaterThan(0);
    const list = buildBellaNotifications({ summary }, { now: NOW });
    expect(list.some((n) => n.category === "sistema")).toBe(true);
  });

  it("conta notificações críticas", async () => {
    const summary = await makeSummary();
    const count = countCriticalNotifications({ summary }, { now: NOW });
    expect(count).toBe(
      buildBellaNotifications({ summary }, { now: NOW }).filter(
        (n) => n.severity === "critical",
      ).length,
    );
  });

  it("registro cobre todas as regras executadas", () => {
    expect(PROACTIVE_REGISTRY).toHaveLength(PROACTIVE_RULE_COUNT);
    expect(PROACTIVE_RULES).toHaveLength(21);
    expect(listProactiveRuleIds()).toContain("retirada_risco");
    expect(getProactiveRule("caixa_critico")?.category).toBe("caixa");
    expect(getProactiveRule("inexistente")).toBeUndefined();
  });
});

describe("proactive · store de sessão", () => {
  beforeEach(() => bellaNotificationStore.reset());

  it("publica, dispensa e restaura sem tocar em banco", () => {
    const list = [
      notification({ id: "crit", severity: "critical" }),
      notification({ id: "info", severity: "info" }),
    ];
    bellaNotificationStore.setNotifications(list);
    expect(bellaNotificationStore.visible()).toHaveLength(2);
    expect(bellaNotificationStore.criticalCount()).toBe(1);

    bellaNotificationStore.dismiss("info");
    expect(bellaNotificationStore.visible().map((n) => n.id)).toEqual(["crit"]);

    bellaNotificationStore.dismiss("crit");
    expect(bellaNotificationStore.visible().map((n) => n.id)).toEqual(["crit"]);

    bellaNotificationStore.restore("info");
    expect(bellaNotificationStore.visible()).toHaveLength(2);

    bellaNotificationStore.dismiss("info");
    bellaNotificationStore.clearDismissed();
    expect(bellaNotificationStore.visible()).toHaveLength(2);
  });

  it("notifica assinantes apenas quando o conjunto muda", () => {
    let calls = 0;
    const unsubscribe = bellaNotificationStore.subscribe(() => {
      calls += 1;
    });
    const list = [notification({ id: "a" })];
    bellaNotificationStore.setNotifications(list);
    bellaNotificationStore.setNotifications([...list]);
    expect(calls).toBe(1);
    unsubscribe();
    bellaNotificationStore.setNotifications([notification({ id: "b" })]);
    expect(calls).toBe(1);
  });
});

describe("proactive · integração com chat e skills", () => {
  it("reconhece a pergunta \"o que aconteceu hoje?\"", () => {
    const match = detectIntent("O que aconteceu hoje?");
    expect(match.intent).toBe("resumo_do_dia");
    const plan = planIntent(match);
    expect(plan.steps.map((s) => s.skillId)).toEqual([
      "consultar_alertas",
      "consultar_insights",
      "consultar_recomendacoes",
      "consultar_notificacoes",
    ]);
  });

  it("skill consultar_notificacoes devolve notificações reais", async () => {
    const skill = getAccountingSkill("consultar_notificacoes")!;
    expect(skill.readOnly).toBe(true);
    const result = await skill.run("c1", {
      services: makeTestServices(),
      period: testPeriod,
      today: testToday,
    });
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    expect((result.data as BellaNotification[]).length).toBeGreaterThan(0);
    expect(result.text.length).toBeGreaterThan(0);
  });
});
