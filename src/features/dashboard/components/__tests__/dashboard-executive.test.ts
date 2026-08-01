import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DollarSign, ShoppingCart } from "lucide-react";
import { HeroMetric } from "../hero-metric";
import { InsightCards, type InsightCardItem } from "../insight-cards";

const render = (el: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(el);

const RAW_COLORS = /\b(bg|text|border)-(emerald|green|red|yellow|rose|amber)-/;

describe("UI.2.1 — HeroMetric", () => {
  it("renderiza rótulo, valor, legenda e ícone", () => {
    const html = render(
      h(HeroMetric, {
        label: "Receita do período",
        value: "R$ 1.234,00",
        caption: "3 vendas faturadas",
        icon: DollarSign,
        status: "success",
      }),
    );
    expect(html).toContain("Receita do período");
    expect(html).toContain("R$ 1.234,00");
    expect(html).toContain("3 vendas faturadas");
    expect(html).toContain('data-testid="hero-metric-icon"');
    expect(html).toContain('data-status="success"');
    expect(html).not.toMatch(RAW_COLORS);
  });

  it("domina a hierarquia com tipografia maior que o MetricCard", () => {
    const html = render(h(HeroMetric, { label: "Receita", value: "R$ 0,00" }));
    expect(html).toContain("text-4xl");
    expect(html).toContain("sm:text-5xl");
  });

  it("exibe skeleton quando carregando e oculta o valor", () => {
    const html = render(
      h(HeroMetric, { label: "Receita", value: "R$ 10,00", loading: true }),
    );
    expect(html).toContain('data-testid="hero-metric-skeleton"');
    expect(html).not.toContain("R$ 10,00");
  });

  it("renderiza o slot lateral quando informado", () => {
    const html = render(
      h(HeroMetric, { label: "Receita", side: h("span", null, "Caixa") }),
    );
    expect(html).toContain('data-testid="hero-metric-side"');
    expect(html).toContain("Caixa");
  });

  it("é responsivo: coluna única no mobile, duas colunas em lg", () => {
    const html = render(h(HeroMetric, { label: "Receita" }));
    expect(html).toContain("lg:grid-cols-[minmax(0,1fr)_auto]");
  });

  it("usa fallback quando não há valor", () => {
    const html = render(h(HeroMetric, { label: "Receita" }));
    expect(html).toContain("—");
  });
});

describe("UI.2.1 — InsightCards", () => {
  const items: InsightCardItem[] = [
    {
      id: "sales",
      label: "Vendas de hoje",
      value: "2 vendas",
      hint: "R$ 300,00",
      icon: ShoppingCart,
      status: "success",
    },
    { id: "stock", label: "Estoque", value: "1 produto", status: "warning" },
  ];

  it("renderiza um card por insight", () => {
    const html = render(h(InsightCards, { items }));
    expect(html.match(/data-testid="insight-card"/g)).toHaveLength(2);
    expect(html).toContain("Vendas de hoje");
    expect(html).toContain("R$ 300,00");
    expect(html).not.toMatch(RAW_COLORS);
  });

  it("exibe empty state limpo quando não há insights", () => {
    const html = render(h(InsightCards, { items: [] }));
    expect(html).toContain('data-testid="insight-cards-empty"');
    expect(html).toContain("Sem insights no momento.");
  });

  it("aceita mensagem de empty state customizada", () => {
    const html = render(
      h(InsightCards, { items: [], emptyMessage: "Nada por aqui" }),
    );
    expect(html).toContain("Nada por aqui");
  });

  it("exibe skeletons enquanto carrega", () => {
    const html = render(h(InsightCards, { items, loading: true }));
    expect(html).toContain('data-testid="insight-cards-loading"');
    expect(html).not.toContain("Vendas de hoje");
  });

  it("é responsivo: 1 coluna no mobile e 2 a partir de sm", () => {
    const html = render(h(InsightCards, { items }));
    expect(html).toContain("sm:grid-cols-2");
  });
});
