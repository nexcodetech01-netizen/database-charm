import { describe, expect, it, vi } from "vitest";
import { SaleEngine } from "../../engine";
import { createSaleDraftState, saleReducer } from "../../store/sale-store";
import {
  cartItemKey,
  countCartUnits,
  resolveActiveCartKey,
  toCartItem,
} from "../lib/cart";
import {
  createPdvFocusController,
  pdvQuantityInputId,
  resolvePdvFocus,
  PDV_FOCUS_IDS,
} from "../lib/focus";
import {
  createSearchCache,
  pickSearchProduct,
  searchCacheKey,
  type PdvSearchOption,
} from "../lib/search-cache";
import { handleBarcodeScan } from "../lib/barcode";
import type { PDVProductOption } from "../types";

const CAMISETA: PdvSearchOption = {
  id: "p1",
  name: "Camiseta Preta",
  sku: "PROD-0001",
  barcode: "7891234567895",
  reference: "REF-77",
  price: 100,
  cost: 40,
  stock: 10,
  unit: "UN",
};

const CANECA: PdvSearchOption = {
  ...CAMISETA,
  id: "p2",
  name: "Caneca Branca",
  sku: "PROD-0002",
  barcode: "7890000000017",
  reference: "REF-88",
  price: 25,
};

describe("PDV 2.8 — foco automático", () => {
  it("abre o PDV com o cursor na pesquisa", () => {
    expect(resolvePdvFocus("mount")).toBe(PDV_FOCUS_IDS.search);
  });

  it("volta para a pesquisa após adicionar produto, bipar e nova venda", () => {
    expect(resolvePdvFocus("product-added")).toBe(PDV_FOCUS_IDS.search);
    expect(resolvePdvFocus("scan")).toBe(PDV_FOCUS_IDS.search);
    expect(resolvePdvFocus("sale-completed")).toBe(PDV_FOCUS_IDS.search);
    expect(resolvePdvFocus("new-sale")).toBe(PDV_FOCUS_IDS.search);
  });

  it("aplica o foco pelo controlador e respeita o estado desabilitado", () => {
    const focus = vi.fn();
    let enabled = true;
    const controller = createPdvFocusController(focus, {
      enabled: () => enabled,
    });

    expect(controller.notify("mount")).toBe(PDV_FOCUS_IDS.search);
    expect(focus).toHaveBeenCalledWith("pdv-search");

    enabled = false;
    expect(controller.notify("product-added")).toBeNull();
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it("resolve o id do input de quantidade do item", () => {
    expect(pdvQuantityInputId("k1")).toBe("pdv-qty-k1");
  });
});

describe("PDV 2.8 — busca sem consultas repetidas", () => {
  it("normaliza o termo (acentos, caixa e espaços)", () => {
    expect(searchCacheKey("  Café  ")).toBe("cafe");
  });

  it("reaproveita o resultado do mesmo termo dentro da validade", () => {
    let clock = 0;
    const cache = createSearchCache<PdvSearchOption[]>({
      ttlMs: 1000,
      now: () => clock,
    });
    cache.set("camiseta", [CAMISETA]);
    expect(cache.get("CAMISETA")).toHaveLength(1);
    clock = 1500;
    expect(cache.get("camiseta")).toBeUndefined();
  });

  it("descarta o termo mais antigo ao atingir o limite", () => {
    const cache = createSearchCache<PdvSearchOption[]>({ max: 2 });
    cache.set("a", []);
    cache.set("b", []);
    cache.set("c", []);
    expect(cache.size()).toBe(2);
    expect(cache.has("a")).toBe(false);
    expect(cache.has("c")).toBe(true);
  });

  it("casa por código de barras, SKU, referência e nome", () => {
    const options = [CAMISETA, CANECA];
    expect(pickSearchProduct("7890000000017", options)?.id).toBe("p2");
    expect(pickSearchProduct("PROD-0001", options)?.id).toBe("p1");
    expect(pickSearchProduct("REF-88", options)?.id).toBe("p2");
    expect(pickSearchProduct("Caneca Branca", options)?.id).toBe("p2");
    expect(pickSearchProduct("camis", options)).toBeNull();
    expect(pickSearchProduct("camis", [CAMISETA])?.id).toBe("p1");
  });
});

describe("PDV 2.8 — leitor USB (keyboard wedge)", () => {
  it("ENTER adiciona o produto lido e devolve o foco à pesquisa", async () => {
    const onProduct = vi.fn();
    const clearBuffer = vi.fn();
    const focusInput = vi.fn();

    const result = await handleBarcodeScan("7891234567895", {
      lookup: async () => [CAMISETA],
      onProduct,
      onNotFound: vi.fn(),
      clearBuffer,
      focusInput,
    });

    expect(result.status).toBe("added");
    expect(onProduct).toHaveBeenCalledWith(CAMISETA);
    expect(clearBuffer).toHaveBeenCalledTimes(1);
    expect(focusInput).toHaveBeenCalledTimes(1);
  });

  it("avisa quando o código não existe, sem travar a operação", async () => {
    const onNotFound = vi.fn();
    const focusInput = vi.fn();
    const result = await handleBarcodeScan("0000000000000", {
      lookup: async () => [],
      onProduct: vi.fn(),
      onNotFound,
      clearBuffer: vi.fn(),
      focusInput,
    });
    expect(result.status).toBe("not_found");
    expect(onNotFound).toHaveBeenCalledTimes(1);
    expect(focusInput).toHaveBeenCalledTimes(1);
  });
});

describe("PDV 2.8 — item ativo, remoção e quantidade", () => {
  const item1 = toCartItem(CAMISETA as PDVProductOption);
  const item2 = toCartItem(CANECA as PDVProductOption);

  it("usa o último item adicionado quando nada foi selecionado", () => {
    expect(resolveActiveCartKey([item1, item2], null)).toBe(cartItemKey(item2));
  });

  it("mantém o item selecionado enquanto ele existir", () => {
    expect(resolveActiveCartKey([item1, item2], cartItemKey(item1))).toBe(
      cartItemKey(item1),
    );
    expect(resolveActiveCartKey([item2], cartItemKey(item1))).toBe(
      cartItemKey(item2),
    );
    expect(resolveActiveCartKey([], cartItemKey(item1))).toBeNull();
  });

  it("remove o item ativo pelo reducer existente", () => {
    let state = { ...createSaleDraftState(), items: [item1, item2] };
    const target = resolveActiveCartKey(state.items, null)!;
    state = saleReducer(state, { type: "REMOVE_ITEM", uiKey: target });
    expect(state.items).toHaveLength(1);
    expect(state.items[0].product_id).toBe("p1");
  });

  it("altera a quantidade inline e atualiza os totais pelo SaleEngine", () => {
    let state = { ...createSaleDraftState(), items: [item1] };
    expect(SaleEngine.computeTotals(state).grand_total).toBe(100);

    state = saleReducer(state, {
      type: "UPDATE_ITEM",
      uiKey: item1.ui_key!,
      patch: { quantity: 3 },
    });

    expect(countCartUnits(state.items)).toBe(3);
    const totals = SaleEngine.computeTotals(state);
    expect(totals.items_total).toBe(300);
    expect(totals.grand_total).toBe(300);
  });

  it("recalcula subtotal, desconto e total ao aplicar desconto", () => {
    const state = {
      ...createSaleDraftState({ discount: 50 }),
      items: [item1, item2],
    };
    const totals = SaleEngine.computeTotals(state);
    expect(totals.items_total).toBe(125);
    expect(totals.grand_total).toBe(75);
    expect(countCartUnits(state.items)).toBe(2);
  });
});
