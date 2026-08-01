import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Activity } from "lucide-react";
import {
  ChartCard,
  MetricCard,
  PageHeader,
  Panel,
  SectionHeader,
  StatusBadge,
} from "../index";
import { STATUS_KEYS, statusToken } from "@/design";

const render = (el: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(el);

describe("UI.1.2 — MetricCard", () => {
  it("renderiza título, valor, rodapé e ícone", () => {
    const html = render(
      createElement(MetricCard, {
        title: "Faturamento",
        value: "R$ 1.000,00",
        footer: "3 vendas",
        icon: Activity,
      }),
    );
    expect(html).toContain("Faturamento");
    expect(html).toContain("R$ 1.000,00");
    expect(html).toContain("3 vendas");
    expect(html).toContain('data-testid="metric-card-icon"');
  });

  it("mostra skeleton e esconde valor em loading", () => {
    const html = render(
      createElement(MetricCard, {
        title: "Caixa",
        value: "R$ 50,00",
        footer: "hoje",
        loading: true,
      }),
    );
    expect(html).toContain('data-testid="metric-card-skeleton"');
    expect(html).not.toContain("R$ 50,00");
    expect(html).not.toContain("hoje");
  });

  it("usa em-dash quando não há valor", () => {
    expect(render(createElement(MetricCard, { title: "Vazio" }))).toContain("—");
  });

  it("aplica tokens de status na tendência, sem cores cruas", () => {
    const html = render(
      createElement(MetricCard, {
        title: "Lucro",
        value: "R$ 10",
        status: "success",
        trend: { value: "+12%", direction: "up", status: "success" },
      }),
    );
    expect(html).toContain('data-direction="up"');
    expect(html).toContain("bg-status-success-surface");
    expect(html).not.toMatch(/emerald|red-|amber|rose|green-/);
  });
});

describe("UI.1.2 — StatusBadge", () => {
  it("cobre os 11 estados exigidos usando apenas tokens", () => {
    const states = [
      "draft",
      "pending",
      "processing",
      "approved",
      "success",
      "warning",
      "danger",
      "rejected",
      "cancelled",
      "neutral",
      "critical",
    ] as const;
    expect(states.every((s) => STATUS_KEYS.includes(s))).toBe(true);
    for (const state of states) {
      const html = render(createElement(StatusBadge, { status: state }, state));
      expect(html).toContain(`data-status="${state}"`);
      expect(html).toContain(`bg-status-${state}-surface`);
      expect(html).not.toMatch(/emerald|amber|rose|\bred-\d|\bgreen-\d/);
    }
  });

  it("suporta variantes solid e outline", () => {
    expect(
      render(createElement(StatusBadge, { status: "approved", appearance: "solid" })),
    ).toContain(statusToken("approved").solid.split(" ")[0]);
    expect(
      render(createElement(StatusBadge, { status: "danger", appearance: "outline" })),
    ).toContain("border-status-danger");
  });

  it("cai em neutral para status desconhecido e renderiza o ponto", () => {
    const html = render(
      createElement(StatusBadge, { status: "xpto", withDot: true }, "Outro"),
    );
    expect(html).toContain("bg-status-neutral");
    expect(html).toContain("Outro");
  });
});

describe("UI.1.2 — PageHeader / SectionHeader", () => {
  it("renderiza título, descrição, breadcrumb, actions e extra", () => {
    const html = render(
      createElement(PageHeader, {
        title: "Dashboard",
        description: "Resumo do dia",
        breadcrumb: createElement("nav", null, "Início"),
        actions: createElement("button", null, "Nova venda"),
        extra: createElement("div", null, "KPIs"),
        icon: Activity,
      }),
    );
    expect(html).toContain("<h1");
    expect(html).toContain("Dashboard");
    expect(html).toContain("Resumo do dia");
    expect(html).toContain('data-testid="page-header-breadcrumb"');
    expect(html).toContain('data-testid="page-header-actions"');
    expect(html).toContain('data-testid="page-header-extra"');
  });

  it("omite slots opcionais quando ausentes", () => {
    const html = render(createElement(PageHeader, { title: "Só título" }));
    expect(html).not.toContain('data-testid="page-header-actions"');
    expect(html).not.toContain('data-testid="page-header-extra"');
  });

  it("SectionHeader é leve e usa h2", () => {
    const html = render(
      createElement(SectionHeader, {
        title: "Indicadores",
        description: "Do período",
        actions: createElement("button", null, "Ver"),
      }),
    );
    expect(html).toContain("<h2");
    expect(html).toContain("Indicadores");
    expect(html).toContain('data-testid="section-header-actions"');
  });
});

describe("UI.1.2 — ChartCard", () => {
  it("renderiza conteúdo quando há dados", () => {
    const html = render(
      createElement(
        ChartCard,
        { title: "Vendas", summary: "Últimos 30 dias" },
        createElement("svg", null),
      ),
    );
    expect(html).toContain('data-testid="chart-card-content"');
    expect(html).toContain("Últimos 30 dias");
  });

  it("mostra loading", () => {
    const html = render(createElement(ChartCard, { title: "Vendas", loading: true }));
    expect(html).toContain('data-testid="chart-card-skeleton"');
    expect(html).not.toContain('data-testid="chart-card-content"');
  });

  it("mostra empty state", () => {
    const html = render(
      createElement(ChartCard, { title: "Vendas", empty: true }),
    );
    expect(html).toContain('data-testid="chart-card-empty"');
    expect(html).toContain("Sem dados para exibir no período.");
  });
});

describe("UI.1.2 — Panel", () => {
  it("aplica radius, sombra e densidade por token", () => {
    const html = render(createElement(Panel, { stack: true }, "conteúdo"));
    expect(html).toContain("rounded-xl");
    expect(html).toContain("shadow-card");
    expect(html).toContain("p-6");
    expect(html).toContain("space-y-6");
  });

  it("respeita density, elevation e flush", () => {
    const html = render(
      createElement(
        Panel,
        { density: "compact", elevation: "floating", flush: true, as: "section" },
        "x",
      ),
    );
    expect(html).toContain("<section");
    expect(html).toContain("shadow-floating");
    expect(html).not.toContain(" p-2");
  });
});
