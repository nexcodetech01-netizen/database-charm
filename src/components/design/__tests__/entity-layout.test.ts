import { describe, expect, it } from "vitest";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Activity, Users } from "lucide-react";
import {
  ActionToolbar,
  EntityHeader,
  FormGroup,
  FormLayout,
  MetricCard,
  MetricGrid,
  Section,
  StatStack,
} from "../index";

const render = (el: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(el);

const RAW_COLORS = /\b(bg|text|border)-(emerald|green|red|yellow|rose|amber)-/;

describe("UI.1.4 — EntityHeader", () => {
  it("renderiza título, descrição, breadcrumb, status e ações", () => {
    const html = render(
      h(EntityHeader, {
        title: "Cliente Bloom",
        description: "Ficha completa",
        breadcrumb: h("nav", null, "Clientes / Bloom"),
        status: { label: "Ativo", status: "success" },
        actions: h("button", null, "Editar"),
        icon: Users,
      }),
    );
    expect(html).toContain("Cliente Bloom");
    expect(html).toContain("Ficha completa");
    expect(html).toContain('data-testid="page-header-breadcrumb"');
    expect(html).toContain('data-testid="page-header-actions"');
    expect(html).toContain('data-status="success"');
    expect(html).not.toMatch(RAW_COLORS);
  });

  it("usa avatar no lugar do ícone quando informado", () => {
    const html = render(h(EntityHeader, { title: "Bloom", avatar: "BL" }));
    expect(html).toContain('data-testid="entity-header-avatar"');
  });

  it("exibe métricas rápidas", () => {
    const html = render(
      h(EntityHeader, {
        title: "Bloom",
        metrics: [{ label: "Receita", value: "R$ 10" }],
      }),
    );
    expect(html).toContain('data-testid="stat-stack"');
    expect(html).toContain("Receita");
    expect(html).toContain("R$ 10");
  });
});

describe("UI.1.4 — ActionToolbar", () => {
  it("só renderiza as ações recebidas", () => {
    const html = render(h(ActionToolbar, { onCreate: () => {} }));
    expect(html).toContain('data-testid="action-toolbar-create"');
    expect(html).not.toContain('data-testid="action-toolbar-delete"');
    expect(html).not.toContain('data-testid="action-toolbar-import"');
  });

  it("renderiza todas as ações padrão", () => {
    const html = render(
      h(ActionToolbar, {
        onCreate: () => {},
        onEdit: () => {},
        onDelete: () => {},
        onImport: () => {},
        onExport: () => {},
      }),
    );
    for (const key of ["create", "edit", "delete", "import", "export"]) {
      expect(html).toContain(`data-testid="action-toolbar-${key}"`);
    }
  });

  it("expõe pesquisa opcional e slot livre", () => {
    const html = render(
      h(
        ActionToolbar,
        {
          search: { value: "abc", onChange: () => {}, placeholder: "Buscar" },
        },
        h("span", null, "slot-extra"),
      ),
    );
    expect(html).toContain('data-testid="action-toolbar-search"');
    expect(html).toContain('value="abc"');
    expect(html).toContain("slot-extra");
  });

  it("agrupa ações extras em Mais ações", () => {
    const html = render(
      h(ActionToolbar, {
        moreActions: [{ label: "Arquivar", icon: Activity }],
      }),
    );
    expect(html).toContain('data-testid="action-toolbar-more"');
  });

  it("respeita o alinhamento", () => {
    expect(render(h(ActionToolbar, { align: "start" }))).toContain("justify-start");
    expect(render(h(ActionToolbar, {}))).toContain("justify-end");
  });
});

describe("UI.1.4 — MetricGrid", () => {
  it("é responsivo por padrão", () => {
    const html = render(h(MetricGrid, null, h(MetricCard, { title: "A", value: "1" })));
    expect(html).toContain('data-testid="metric-grid"');
    expect(html).toContain("grid-cols-1");
    expect(html).toContain("sm:grid-cols-2");
    expect(html).toContain("lg:grid-cols-4");
    expect(html).toContain("A");
  });

  it("suporta 2, 3 e 5 colunas", () => {
    expect(render(h(MetricGrid, { columns: 2 }))).toContain("lg:grid-cols-2");
    expect(render(h(MetricGrid, { columns: 3 }))).toContain("lg:grid-cols-3");
    expect(render(h(MetricGrid, { columns: 5 }))).toContain("xl:grid-cols-5");
  });
});

describe("UI.1.4 — StatStack", () => {
  it("renderiza itens com ícone e dica", () => {
    const html = render(
      h(StatStack, {
        items: [
          { label: "Clientes", value: "12", hint: "no mês", icon: Users },
          { label: "Pedidos" },
        ],
      }),
    );
    expect(html).toContain("Clientes");
    expect(html).toContain("no mês");
    expect(html).toContain('data-testid="stat-stack-icon"');
    expect(html).toContain("—");
    expect(html).not.toMatch(RAW_COLORS);
  });

  it("alterna orientação e mostra skeleton em loading", () => {
    const html = render(
      h(StatStack, {
        orientation: "horizontal",
        loading: true,
        items: [{ label: "Receita", value: "R$ 1" }],
      }),
    );
    expect(html).toContain('data-orientation="horizontal"');
    expect(html).toContain('data-testid="stat-stack-skeleton"');
    expect(html).not.toContain("R$ 1");
  });
});

describe("UI.1.4 — Section", () => {
  it("renderiza header, body e footer", () => {
    const html = render(
      h(
        Section,
        {
          title: "Resumo",
          description: "Últimos 30 dias",
          actions: h("button", null, "Ver"),
          footer: h("span", null, "rodapé"),
        },
        h("p", null, "conteúdo"),
      ),
    );
    expect(html).toContain('data-testid="section-header"');
    expect(html).toContain('data-testid="section-body"');
    expect(html).toContain('data-testid="section-footer"');
    expect(html).toContain("Resumo");
    expect(html).toContain("conteúdo");
    expect(html).toContain("rodapé");
  });

  it("omite header e footer quando não informados", () => {
    const html = render(h(Section, null, h("p", null, "só corpo")));
    expect(html).not.toContain('data-testid="section-header"');
    expect(html).not.toContain('data-testid="section-footer"');
  });

  it("permite corpo sem padding", () => {
    const html = render(h(Section, { flushBody: true }, h("table", null)));
    expect(html).toContain('data-testid="section-body"');
  });
});

describe("UI.1.4 — FormLayout", () => {
  it("aplica largura e renderiza sidebar e footer", () => {
    const html = render(
      h(
        FormLayout,
        {
          width: "md",
          sidebar: h("aside", null, "ajuda"),
          footer: h("button", null, "Salvar"),
        },
        h("input", null),
      ),
    );
    expect(html).toContain('data-width="md"');
    expect(html).toContain("max-w-3xl");
    expect(html).toContain('data-testid="form-layout-sidebar"');
    expect(html).toContain('data-testid="form-layout-footer"');
  });

  it("agrupa campos com colunas responsivas", () => {
    const html = render(
      h(FormGroup, { title: "Dados", columns: 3 }, h("input", null)),
    );
    expect(html).toContain('data-testid="form-group"');
    expect(html).toContain('data-columns="3"');
    expect(html).toContain("sm:grid-cols-2");
    expect(html).toContain("lg:grid-cols-3");
  });
});
