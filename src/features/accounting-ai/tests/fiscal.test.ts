import { describe, expect, it } from "vitest";
import {
  BELLA_FISCAL_LINKS,
  BELLA_FISCAL_LINK_ORDER,
  FISCAL_CATEGORIES,
  averageAuthorizationMinutes,
  buildBellaFiscalView,
  buildFiscalAlerts,
  buildFiscalDetails,
  buildFiscalHealth,
  buildFiscalMetrics,
  buildFiscalRecommendations,
  countFiscalDocuments,
  filterFiscalInsights,
  filterFiscalNotifications,
  fiscalLink,
  fiscalLinkForAction,
  fiscalLinks,
  fiscalTimelineLink,
  formatFiscalMetric,
  isFiscalCategory,
  lastCancelled,
  lastIssued,
  type BellaFiscalDocLike,
} from "../fiscal";
import { detectIntent, planIntent } from "../chat";
import { makeNotification, type BellaNotification } from "../proactive";
import type { AccountingInsight } from "../insights";
import { makeSummary } from "./fixtures";

const NOW = "2026-02-10T12:00:00.000Z";

function doc(over: Partial<BellaFiscalDocLike> = {}): BellaFiscalDocLike {
  return {
    id: "d1",
    status: "authorized",
    model: "55",
    number: 1,
    environment: "production",
    xmlAuthorizedPath: "xml/1.xml",
    danfePath: "danfe/1.pdf",
    protocolAt: "2026-02-09T10:05:00.000Z",
    createdAt: "2026-02-09T10:00:00.000Z",
    ...over,
  };
}

function insight(over: Partial<AccountingInsight> = {}): AccountingInsight {
  return {
    id: "i1",
    severity: "warning",
    category: "fiscal",
    title: "Impostos a programar",
    description: "Competência aberta",
    recommendation: "Reserve o valor do imposto",
    priority: 70,
    action: { id: "acompanhar", label: "Acompanhar impostos" },
    sourceProvider: "taxes",
    createdAt: NOW,
    ...over,
  };
}

function notification(over: Partial<Parameters<typeof makeNotification>[0]> = {}): BellaNotification {
  return makeNotification({
    id: "n1",
    category: "fiscal",
    severity: "critical",
    title: "Imposto vencendo",
    message: "Guia vence amanhã",
    recommendation: "Programe o pagamento",
    action: "programar_imposto",
    createdAt: NOW,
    ...over,
  });
}

describe("accounting-ai · fiscal · links", () => {
  it("expõe os destinos previstos e só navega", () => {
    expect(fiscalLinks()).toHaveLength(BELLA_FISCAL_LINK_ORDER.length);
    for (const link of fiscalLinks()) {
      expect(link.href.startsWith("/fiscal")).toBe(true);
    }
    expect(fiscalLink("abrir_configuracao").href).toBe("/fiscal/configuracao");
  });

  it("mapeia ações de insight/notificação para navegação fiscal", () => {
    expect(fiscalLinkForAction("programar_imposto")).toBe(BELLA_FISCAL_LINKS.abrir_configuracao);
    expect(fiscalLinkForAction("acao_inexistente")).toBe(BELLA_FISCAL_LINKS.abrir_fiscal);
  });

  it("aponta a linha do tempo para o documento quando existe", () => {
    expect(fiscalTimelineLink("abc").href).toBe("/fiscal/notas/abc");
    expect(fiscalTimelineLink(null).href).toBe("/fiscal/notas");
  });
});

describe("accounting-ai · fiscal · contagens", () => {
  const docs: BellaFiscalDocLike[] = [
    doc({ id: "a", model: "55" }),
    doc({ id: "b", model: "65", xmlAuthorizedPath: null }),
    doc({ id: "c", status: "rejected", protocolAt: null, rejectionReason: "CST inválido" }),
    doc({ id: "d", status: "sending", protocolAt: null }),
    doc({ id: "e", status: "cancelled", cancelledAt: "2026-02-09T18:00:00.000Z" }),
    doc({ id: "f", status: "discarded", discardedAt: "2026-02-08T10:00:00.000Z" }),
    doc({ id: "g", status: "error", protocolAt: null }),
    doc({ id: "h", danfePath: null, model: "65" }),
  ];

  it("conta status, modelos e artefatos ausentes", () => {
    const c = countFiscalDocuments(docs);
    expect(c.total).toBe(8);
    expect(c.authorized).toBe(3);
    expect(c.nfe).toBe(1);
    expect(c.nfce).toBe(2);
    expect(c.pending).toBe(1);
    expect(c.rejected).toBe(1);
    expect(c.cancelled).toBe(1);
    expect(c.discarded).toBe(1);
    expect(c.error).toBe(1);
    expect(c.xmlMissing).toBe(1);
    expect(c.danfeMissing).toBe(1);
  });

  it("calcula o tempo médio de autorização em minutos", () => {
    expect(averageAuthorizationMinutes(docs)).toBe(5);
    expect(averageAuthorizationMinutes([])).toBeNull();
  });

  it("resolve última emissão e último cancelamento", () => {
    expect(lastIssued(docs)?.status).toBe("authorized");
    expect(lastCancelled(docs)?.id).toBe("e");
    expect(lastCancelled([])).toBeNull();
  });
});

describe("accounting-ai · fiscal · resumo", () => {
  it("gera os 10 indicadores mesmo sem documentos", () => {
    const metrics = buildFiscalMetrics(null);
    expect(metrics).toHaveLength(10);
    expect(metrics.every((m) => !m.available)).toBe(true);
    expect(formatFiscalMetric(metrics[0]!)).toBe("—");
  });

  it("formata contagem e tempo médio", () => {
    const metrics = buildFiscalMetrics([doc()]);
    const emitidas = metrics.find((m) => m.id === "emitidas")!;
    const tempo = metrics.find((m) => m.id === "tempo_medio_autorizacao")!;
    expect(formatFiscalMetric(emitidas)).toBe("1");
    expect(formatFiscalMetric(tempo)).toBe("5 min");
  });

  it("marca NF-e/NFC-e como indisponível quando o modelo não vem do Fiscal v2", () => {
    const metrics = buildFiscalMetrics([doc({ model: null })]);
    expect(metrics.find((m) => m.id === "nfe")!.available).toBe(false);
    expect(metrics.find((m) => m.id === "nfce")!.available).toBe(false);
  });

  it("monta detalhes com ambiente, certificado e prontidão", () => {
    const details = buildFiscalDetails(
      [doc({ id: "x", cancelledAt: "2026-02-09T18:00:00.000Z", status: "cancelled" })],
      [{ id: "c1", isActive: true, validTo: "2026-03-01T00:00:00.000Z" }],
      { percent: 80, blockers: 0, warnings: 1, ready: true, environment: "production" },
      NOW,
    );
    expect(details).toHaveLength(5);
    expect(details.find((d) => d.id === "ambiente")!.value).toBe("Produção");
    expect(details.find((d) => d.id === "prontidao")!.value).toBe("80%");
    expect(details.find((d) => d.id === "certificado")!.hint).toContain("dia(s)");
    expect(details.find((d) => d.id === "ultimo_cancelamento")!.available).toBe(true);
  });

  it("usa a saúde já apurada pelo resumo contábil", async () => {
    const health = buildFiscalHealth(await makeSummary());
    expect(health === null || typeof health.score === "number").toBe(true);
    expect(buildFiscalHealth(null)).toBeNull();
  });
});

describe("accounting-ai · fiscal · alertas", () => {
  it("alerta certificado vencendo, vencido e ausente", () => {
    const soon = buildFiscalAlerts(
      { certificates: [{ id: "c", isActive: true, validTo: "2026-02-20T00:00:00.000Z" }] },
      { now: NOW },
    );
    expect(soon.some((a) => a.id === "certificado_vencendo")).toBe(true);

    const expired = buildFiscalAlerts(
      { certificates: [{ id: "c", isActive: true, validTo: "2026-01-01T00:00:00.000Z" }] },
      { now: NOW },
    );
    expect(expired.some((a) => a.id === "certificado_vencido")).toBe(true);

    const none = buildFiscalAlerts({ certificates: [] }, { now: NOW });
    expect(none.some((a) => a.id === "certificado_ausente")).toBe(true);
  });

  it("alerta rejeições, XML/DANFE ausentes, pendências, descartes e falhas", () => {
    const docs = [
      doc({ id: "1", status: "rejected" }),
      doc({ id: "2", status: "rejected" }),
      doc({ id: "3", status: "rejected" }),
      doc({ id: "4", xmlAuthorizedPath: null }),
      doc({ id: "5", danfePath: null }),
      doc({ id: "6", status: "sending" }),
      doc({ id: "7", status: "discarded" }),
      doc({ id: "8", status: "error" }),
    ];
    const ids = buildFiscalAlerts({ documents: docs }, { now: NOW, alertLimit: 20 }).map((a) => a.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "muitas_rejeicoes",
        "xml_ausente",
        "danfe_ausente",
        "aguardando_processamento",
        "notas_descartadas",
        "falhas_recentes",
      ]),
    );
  });

  it("avisa homologação e configuração incompleta", () => {
    const ids = buildFiscalAlerts(
      {
        readiness: { percent: 40, blockers: 2, warnings: 1, ready: false, environment: "homologation" },
      },
      { now: NOW, alertLimit: 20 },
    ).map((a) => a.id);
    expect(ids).toContain("nfce_homologacao");
    expect(ids).toContain("configuracao_incompleta");
  });

  it("inclui notificações proativas fiscais e ordena por severidade", () => {
    const alerts = buildFiscalAlerts(
      {
        documents: [doc({ status: "sending", protocolAt: null })],
        notifications: [notification(), notification({ id: "n2", category: "caixa" })],
      },
      { now: NOW, alertLimit: 20 },
    );
    expect(alerts.some((a) => a.id === "n1" && a.source === "proactive")).toBe(true);
    expect(alerts.some((a) => a.id === "n2")).toBe(false);
    expect(alerts[0]!.severity).toBe("critical");
  });

  it("respeita o limite de alertas", () => {
    const alerts = buildFiscalAlerts(
      { documents: [doc({ status: "error" }), doc({ id: "2", status: "discarded" })] },
      { now: NOW, alertLimit: 1 },
    );
    expect(alerts).toHaveLength(1);
  });
});

describe("accounting-ai · fiscal · recomendações e filtros", () => {
  it("filtra apenas categorias fiscais", () => {
    expect(FISCAL_CATEGORIES).toEqual(["fiscal"]);
    expect(isFiscalCategory("fiscal")).toBe(true);
    expect(isFiscalCategory("caixa")).toBe(false);
    expect(filterFiscalInsights([insight(), insight({ id: "i2", category: "caixa" })])).toHaveLength(1);
    expect(
      filterFiscalNotifications([notification(), notification({ id: "n9", category: "lucro" })]),
    ).toHaveLength(1);
  });

  it("converte insights fiscais em recomendações navegáveis", () => {
    const recs = buildFiscalRecommendations([insight(), insight({ id: "i2", category: "estoque" })]);
    expect(recs).toHaveLength(1);
    expect(recs[0]!.link.href).toBe("/fiscal");
  });
});

describe("accounting-ai · fiscal · view", () => {
  it("monta a view completa a partir de dados existentes", async () => {
    const view = buildBellaFiscalView(
      {
        summary: await makeSummary(),
        documents: [doc(), doc({ id: "2", status: "rejected", protocolAt: null })],
        certificates: [{ id: "c", isActive: true, validTo: "2027-01-01T00:00:00.000Z" }],
        readiness: { percent: 100, blockers: 0, warnings: 0, ready: true, environment: "production" },
        insights: [insight()],
        notifications: [notification()],
      },
      { now: NOW },
    );

    expect(view.available).toBe(true);
    expect(view.generatedAt).toBe(NOW);
    expect(view.metrics).toHaveLength(10);
    expect(view.details).toHaveLength(5);
    expect(view.recommendations).toHaveLength(1);
    expect(view.alerts.length).toBeGreaterThan(0);
    expect(view.missing).toHaveLength(0);
  });

  it("degrada com elegância sem nenhum dado", () => {
    const view = buildBellaFiscalView({}, { now: NOW });
    expect(view.available).toBe(false);
    expect(view.alerts).toHaveLength(0);
    expect(view.recommendations).toHaveLength(0);
    expect(view.health).toBeNull();
    expect(view.missing).toEqual([
      "documentos fiscais",
      "resumo contábil",
      "configuração fiscal",
    ]);
  });
});

describe("accounting-ai · fiscal · chat", () => {
  it("reconhece 'como está meu fiscal?' e planeja skills existentes", () => {
    const match = detectIntent("Como está meu fiscal?");
    expect(match.intent).toBe("situacao_fiscal");
    const plan = planIntent(match);
    expect(plan.steps.map((s) => s.skillId)).toEqual([
      "consultar_saude",
      "consultar_alertas",
      "consultar_recomendacoes",
      "consultar_notificacoes",
    ]);
  });

  it("mantém a intenção de impostos para perguntas tributárias", () => {
    expect(detectIntent("quanto vou pagar de imposto?").intent).toBe("consultar_impostos");
  });
});
