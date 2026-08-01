import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Package } from "lucide-react";
import {
  DataTableActions,
  DataTablePagination,
  EnterpriseDataTable,
  type DataTableColumn,
} from "../index";

type Row = { id: string; name: string; qty: number };

const rows: Row[] = [
  { id: "1", name: "Camisa", qty: 3 },
  { id: "2", name: "Calça", qty: 0 },
];

const columns: DataTableColumn<Row>[] = [
  { id: "name", header: "Produto", cell: (r) => r.name },
  { id: "qty", header: "Qtd", align: "right", cell: (r) => r.qty, hideBelow: "md" },
];

const render = (el: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(el);

const base = {
  rows,
  columns,
  getRowId: (r: Row) => r.id,
};

describe("UI.1.3 — EnterpriseDataTable", () => {
  it("renderiza cabeçalhos e linhas", () => {
    const html = render(createElement(EnterpriseDataTable<Row>, base));
    expect(html).toContain("Produto");
    expect(html).toContain("Camisa");
    expect(html).toContain("Calça");
    expect(html).toContain('data-testid="enterprise-data-table"');
  });

  it("mostra skeleton em loading e esconde as linhas", () => {
    const html = render(
      createElement(EnterpriseDataTable<Row>, { ...base, isLoading: true, skeletonRows: 3 }),
    );
    expect(html).toContain('data-testid="data-table-loading-row"');
    expect(html).not.toContain("Camisa");
  });

  it("mostra empty state quando não há registros", () => {
    const html = render(
      createElement(EnterpriseDataTable<Row>, {
        ...base,
        rows: [],
        empty: {
          icon: Package,
          title: "Nenhum produto encontrado",
          description: "Ajuste os filtros.",
        },
      }),
    );
    expect(html).toContain("Nenhum produto encontrado");
    expect(html).toContain("Ajuste os filtros.");
  });

  it("mostra estado de erro", () => {
    const html = render(
      createElement(EnterpriseDataTable<Row>, { ...base, rows: [], error: "Falha de rede" }),
    );
    expect(html).toContain("Não foi possível carregar os dados");
    expect(html).toContain("Falha de rede");
  });

  it("renderiza toolbar com título, busca e filtros", () => {
    const html = render(
      createElement(EnterpriseDataTable<Row>, {
        ...base,
        title: "Produtos",
        description: "Catálogo",
        search: { value: "abc", onChange: () => {}, placeholder: "Buscar" },
        filters: createElement("div", null, "FiltroX"),
      }),
    );
    expect(html).toContain('data-testid="data-table-toolbar"');
    expect(html).toContain('data-testid="data-table-search"');
    expect(html).toContain('data-testid="data-table-filters"');
    expect(html).toContain("FiltroX");
    expect(html).toContain("Produtos");
  });

  it("omite a toolbar quando não há nada para exibir", () => {
    const html = render(createElement(EnterpriseDataTable<Row>, base));
    expect(html).not.toContain('data-testid="data-table-toolbar"');
  });

  it("renderiza paginação com resumo padrão", () => {
    const html = render(
      createElement(EnterpriseDataTable<Row>, {
        ...base,
        pagination: { page: 1, pageSize: 20, total: 45, onPageChange: () => {} },
      }),
    );
    expect(html).toContain('data-testid="data-table-pagination"');
    expect(html).toContain("1–20 de 45");
    expect(html).toContain("Página 1 de 3");
  });

  it("desabilita navegação nos limites de paginação", () => {
    const first = render(
      createElement(DataTablePagination, {
        page: 1,
        pageSize: 10,
        total: 10,
        onPageChange: () => {},
      }),
    );
    // única página: ambos os botões desabilitados
    expect(first.match(/disabled=""/g)?.length).toBe(2);
  });

  it("aceita resumo customizado na paginação", () => {
    const html = render(
      createElement(DataTablePagination, {
        page: 2,
        pageSize: 10,
        total: 30,
        onPageChange: () => {},
        summary: "30 clientes",
      }),
    );
    expect(html).toContain("30 clientes");
  });

  it("aplica classes responsivas de coluna", () => {
    const html = render(createElement(EnterpriseDataTable<Row>, base));
    expect(html).toContain("hidden md:table-cell");
    expect(html).toContain("text-right");
  });

  it("renderiza ações de linha e a coluna Ações", () => {
    const html = render(
      createElement(EnterpriseDataTable<Row>, {
        ...base,
        rowActions: () =>
          createElement(DataTableActions, null, createElement("span", null, "Editar")),
      }),
    );
    expect(html).toContain("Ações");
    expect(html).toContain("Mais ações");
  });

  it("marca linhas selecionadas, desabilitadas e clicáveis", () => {
    const onRowClick = vi.fn();
    const html = render(
      createElement(EnterpriseDataTable<Row>, {
        ...base,
        onRowClick,
        isRowSelected: (r: Row) => r.id === "1",
        isRowDisabled: (r: Row) => r.id === "2",
      }),
    );
    expect(html).toContain('data-selected="true"');
    expect(html).toContain('data-disabled="true"');
    expect(html).toContain("cursor-pointer");
  });

  it("não usa cores cruas — apenas tokens semânticos", () => {
    const html = render(
      createElement(EnterpriseDataTable<Row>, {
        ...base,
        pagination: { page: 1, pageSize: 10, total: 2, onPageChange: () => {} },
      }),
    );
    for (const raw of ["emerald-", "green-", "red-", "yellow-", "rose-", "amber-"]) {
      expect(html).not.toContain(raw);
    }
  });
});
