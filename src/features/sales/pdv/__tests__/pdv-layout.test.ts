import { describe, expect, it } from "vitest";
import {
  PDV_LAYOUT,
  PDV_STAGE_LABEL,
  PDV_STATUS_TONE_CLASS,
  buildPdvCustomerDisplay,
  pdvCashStatus,
  resolvePdvStage,
} from "../lib/layout";
import {
  PDV_BARCODE_INPUT_ID,
  PDV_SEARCH_INPUT_ID,
  isTypingTarget,
} from "../hooks/use-pdv-shortcuts";
import type { SaleItemDraft } from "../../types";

const items = [
  {
    ui_key: "k1",
    product_id: "p1",
    description: "Mochila Bloom",
    sku: "PROD-1",
    quantity: 2,
    unit_price: 100,
    discount: 0,
  },
] as unknown as SaleItemDraft[];

describe("PDV — layout profissional (Sprint 2.9 / PDV.3.1)", () => {
  it("mantém o carrinho como maior área e o painel fixo à direita", () => {
    expect(PDV_LAYOUT.grid).toContain("minmax(0,1fr)_380px");
    expect(PDV_LAYOUT.sidePanel).toContain("sticky");
    expect(PDV_LAYOUT.cartScroll).toContain("overflow-y-auto");
    expect(PDV_LAYOUT.cartScroll).toContain("scroll-smooth");
  });

  it("o painel lateral não rola junto do carrinho", () => {
    // O scroll é próprio de cada área (overscroll contido).
    expect(PDV_LAYOUT.cartScroll).toContain("overscroll-contain");
    expect(PDV_LAYOUT.sidePanel).toContain("overscroll-contain");
  });

  it("usa grade responsiva sem quebra de 1366x768 até Full HD", () => {
    expect(PDV_LAYOUT.grid).toContain("lg:grid-cols-");
    expect(PDV_LAYOUT.grid).toContain("xl:grid-cols-");
    expect(PDV_LAYOUT.grid).toContain("2xl:grid-cols-");
    expect(PDV_LAYOUT.cartScroll).toContain("calc(100vh-");
  });

  it("expõe o rodapé compacto de atalhos (somente leitura)", () => {
    expect(PDV_LAYOUT.shortcutBar).toContain("text-[11px]");
    expect(PDV_LAYOUT.shortcutBar).toContain("text-muted-foreground");
  });

  it("resolve o estágio da sessão sem alterar regra de negócio", () => {
    expect(resolvePdvStage({})).toBe("cart");
    expect(resolvePdvStage({ pendingSale: { id: "s1" } })).toBe("receiving");
    expect(
      resolvePdvStage({ pendingSale: { id: "s1" }, completed: { id: "s1" } }),
    ).toBe("completed");
    expect(PDV_STAGE_LABEL.completed).toBe("Venda concluída");
  });

  it("indica o status do caixa com tom correspondente", () => {
    expect(pdvCashStatus({ canOperate: false })).toEqual({
      label: "Caixa fechado",
      tone: "closed",
    });
    expect(
      pdvCashStatus({ canOperate: true, openedAtLabel: "hoje 08:00" }),
    ).toEqual({ label: "Caixa aberto · hoje 08:00", tone: "open" });
    expect(pdvCashStatus({ canOperate: true }).label).toBe("Caixa aberto");
  });

  it("usa apenas tokens do design system nos indicadores de status", () => {
    for (const cls of Object.values(PDV_STATUS_TONE_CLASS)) {
      expect(cls).toContain("status-");
      expect(cls).not.toMatch(/emerald|amber|rose|green|red|yellow/);
    }
    expect(PDV_STATUS_TONE_CLASS.open).toContain("status-success");
    expect(PDV_STATUS_TONE_CLASS.closed).toContain("status-danger");
  });


  it("preserva o foco por teclado: busca e leitor seguem aceitando atalhos", () => {
    expect(
      isTypingTarget({ tagName: "INPUT", id: PDV_SEARCH_INPUT_ID }),
    ).toBe(false);
    expect(
      isTypingTarget({ tagName: "INPUT", id: PDV_BARCODE_INPUT_ID }),
    ).toBe(false);
    expect(isTypingTarget({ tagName: "INPUT", id: "pdv-discount" })).toBe(true);
  });

  it("prepara (sem renderizar) o modelo da segunda tela do cliente", () => {
    const model = buildPdvCustomerDisplay({
      saleNumber: "PDV-1",
      stage: "cart",
      items,
      totals: { items_total: 200, grand_total: 180 },
      itemCount: 2,
      discountValue: 20,
    });
    expect(model).toEqual({
      saleNumber: "PDV-1",
      stage: "cart",
      items: [
        {
          description: "Mochila Bloom",
          quantity: 2,
          unitPrice: 100,
          total: 200,
        },
      ],
      itemCount: 2,
      subtotal: 200,
      discount: 20,
      total: 180,
    });
  });

  it("o modelo da segunda tela funciona com carrinho vazio", () => {
    const model = buildPdvCustomerDisplay({
      saleNumber: "PDV-2",
      stage: "cart",
      items: [],
      totals: { items_total: 0, grand_total: 0 },
      itemCount: 0,
    });
    expect(model.items).toEqual([]);
    expect(model.discount).toBe(0);
    expect(model.total).toBe(0);
  });
});
