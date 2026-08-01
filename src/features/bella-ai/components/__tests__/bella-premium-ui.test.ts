import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PackageMinus } from "lucide-react";
import { BellaGreetingHero } from "../bella-greeting-hero";
import { BellaSkillCard, formatSkillDuration } from "../bella-skill-card";
import { BellaEmptyState } from "../bella-empty-state";
import { BellaPrioritiesBlock } from "../bella-priorities-block";
import type { BellaPriorityItem } from "../../dashboard";

const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

const RAW_COLORS = /\b(bg|text|border)-(emerald|green|red|yellow|rose|amber)-/;

function priority(overrides: Partial<BellaPriorityItem> = {}): BellaPriorityItem {
  return {
    id: "p1",
    eventId: "e1",
    title: "Estoque abaixo do mínimo",
    description: "3 produtos precisam de reposição.",
    recommendation: "Gerar pedido de compra",
    priority: "CRITICAL",
    module: "inventory",
    createdAt: new Date("2026-01-01T10:00:00Z"),
    ...overrides,
  };
}

describe("UI.2.2 — BellaGreetingHero", () => {
  it("renderiza saudação, nome e resumo em linguagem natural", () => {
    const html = render(
      h(BellaGreetingHero, {
        greeting: "Bom dia",
        name: "Ana",
        highlights: ["3 cobranças vencidas", "2 produtos abaixo do mínimo"],
        closing: "Bella segue monitorando.",
      }),
    );
    expect(html).toContain("Bom dia, Ana");
    expect(html).toContain("3 cobranças vencidas");
    expect(html).toContain("2 produtos abaixo do mínimo");
    expect(html).toContain("Bella segue monitorando.");
    expect(html).toContain('data-testid="bella-greeting-highlights"');
    expect(html).not.toMatch(RAW_COLORS);
  });

  it("mostra empty state quando não há destaques", () => {
    const html = render(h(BellaGreetingHero, { greeting: "Boa noite", highlights: [] }));
    expect(html).toContain('data-testid="bella-greeting-empty"');
  });

  it("é responsivo (uma coluna no mobile, duas no desktop)", () => {
    const html = render(
      h(BellaGreetingHero, { greeting: "Boa tarde", highlights: ["ok"], side: "lateral" }),
    );
    expect(html).toContain("lg:grid-cols-[minmax(0,1fr)_auto]");
  });
});

describe("UI.2.2 — BellaSkillCard", () => {
  it("exibe nome amigável, resultado, tempo e status", () => {
    const html = render(
      h(BellaSkillCard, {
        name: "Lucro do mês",
        result: "R$ 12.400,00",
        durationMs: 240,
        status: "success",
        icon: PackageMinus,
      }),
    );
    expect(html).toContain("Lucro do mês");
    expect(html).toContain("R$ 12.400,00");
    expect(html).toContain("240 ms");
    expect(html).toContain("Concluída");
    expect(html).toContain('data-status="success"');
    expect(html).not.toMatch(RAW_COLORS);
  });

  it("reflete estados de execução e falha", () => {
    expect(render(h(BellaSkillCard, { name: "X", status: "running" }))).toContain("Executando");
    expect(render(h(BellaSkillCard, { name: "X", status: "error" }))).toContain("Falhou");
  });

  it("formata durações com regra determinística", () => {
    expect(formatSkillDuration(120)).toBe("120 ms");
    expect(formatSkillDuration(1500)).toBe("1.5 s");
    expect(formatSkillDuration(undefined)).toBeNull();
    expect(formatSkillDuration(-1)).toBeNull();
  });
});

describe("UI.2.2 — BellaEmptyState", () => {
  it("padroniza título, descrição e ícone", () => {
    const html = render(
      h(BellaEmptyState, {
        icon: PackageMinus,
        title: "Nada por aqui",
        description: "A Bella avisa quando algo mudar.",
      }),
    );
    expect(html).toContain('data-testid="bella-empty-state"');
    expect(html).toContain("Nada por aqui");
    expect(html).toContain("A Bella avisa quando algo mudar.");
  });
});

describe("UI.2.2 — Prioridades em Timeline", () => {
  it("renderiza a timeline com status semântico", () => {
    const html = render(h(BellaPrioritiesBlock, { priorities: [priority()] }));
    expect(html).toContain('data-testid="bella-priorities-timeline"');
    expect(html).toContain('data-testid="bella-timeline-item"');
    expect(html).toContain('data-priority="CRITICAL"');
    expect(html).toContain("Estoque abaixo do mínimo");
    expect(html).toContain("Sugestão: Gerar pedido de compra");
    expect(html).not.toMatch(RAW_COLORS);
  });

  it("respeita o limite de itens exibidos", () => {
    const items = [priority({ id: "a" }), priority({ id: "b" }), priority({ id: "c" })];
    const html = render(h(BellaPrioritiesBlock, { priorities: items, limit: 2 }));
    expect(html.match(/data-testid="bella-timeline-item"/g)).toHaveLength(2);
  });

  it("usa o empty state padrão quando não há prioridades", () => {
    const html = render(h(BellaPrioritiesBlock, { priorities: [] }));
    expect(html).toContain('data-testid="bella-empty-state"');
    expect(html).toContain("Nenhum evento crítico no momento");
  });
});
