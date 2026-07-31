import { describe, expect, it, vi } from "vitest";
import {
  BARCODE_NOT_FOUND_MESSAGE,
  handleBarcodeScan,
  isNumericBarcode,
  isScannableCode,
  normalizeBarcode,
  pickScannedProduct,
} from "../lib/barcode";
import { findCartItemByProduct, toCartItem } from "../lib/cart";
import { createSaleDraftState, saleReducer } from "../../store/sale-store";
import type { PDVProductOption } from "../types";

const product: PDVProductOption & { barcode?: string | null } = {
  id: "p1",
  name: "Camiseta Bloom",
  sku: "PROD-1",
  barcode: "7891234567895",
  price: 59.9,
  cost: 20,
  stock: 10,
  unit: "UN",
};

function deps(
  options: (PDVProductOption & { barcode?: string | null })[],
  overrides: Partial<Parameters<typeof handleBarcodeScan>[1]> = {},
) {
  return {
    lookup: vi.fn(async () => options),
    onProduct: vi.fn(),
    onNotFound: vi.fn(),
    clearBuffer: vi.fn(),
    focusInput: vi.fn(),
    ...overrides,
  };
}

describe("PDV — código de barras (Sprint 2.7)", () => {
  it("normaliza a sequência enviada pelo leitor", () => {
    expect(normalizeBarcode(" 7891234567895\r\n")).toBe("7891234567895");
    expect(isScannableCode("7891234567895")).toBe(true);
    expect(isScannableCode("ab")).toBe(false);
    expect(isNumericBarcode("7891234567895")).toBe(true); // EAN-13
    expect(isNumericBarcode("12345670")).toBe(true); // EAN-8
    expect(isNumericBarcode("012345678905")).toBe(true); // UPC-A
    expect(isNumericBarcode("PROD-1")).toBe(false);
  });

  it("leitura válida adiciona o produto ao carrinho", async () => {
    const d = deps([product]);
    const result = await handleBarcodeScan("7891234567895", d);
    expect(result).toEqual({ status: "added", product });
    expect(d.lookup).toHaveBeenCalledWith("7891234567895");
    expect(d.onProduct).toHaveBeenCalledWith(product);
    expect(d.onNotFound).not.toHaveBeenCalled();
  });

  it("aceita SKU quando a busca existente já o suporta", async () => {
    const d = deps([{ ...product, barcode: null }]);
    const result = await handleBarcodeScan("PROD-1", d);
    expect(result.status).toBe("added");
  });

  it("produto inexistente avisa e não altera o carrinho", async () => {
    const d = deps([]);
    const result = await handleBarcodeScan("0000000000000", d);
    expect(result).toEqual({ status: "not_found" });
    expect(d.onNotFound).toHaveBeenCalledWith(BARCODE_NOT_FOUND_MESSAGE);
    expect(d.onProduct).not.toHaveBeenCalled();
    expect(BARCODE_NOT_FOUND_MESSAGE).toBe("Produto não encontrado.");
  });

  it("ambiguidade sem correspondência exata não adiciona nada", () => {
    const other = { ...product, id: "p2", sku: "PROD-2", barcode: "999" };
    expect(pickScannedProduct("789", [product, other])).toBeNull();
    expect(pickScannedProduct("7891234567895", [product, other])?.id).toBe("p1");
  });

  it("limpa o buffer e restaura o foco após ENTER (com ou sem produto)", async () => {
    const found = deps([product]);
    await handleBarcodeScan("7891234567895", found);
    expect(found.clearBuffer).toHaveBeenCalledTimes(1);
    expect(found.focusInput).toHaveBeenCalledTimes(1);

    const missing = deps([]);
    await handleBarcodeScan("7891234567895", missing);
    expect(missing.clearBuffer).toHaveBeenCalledTimes(1);
    expect(missing.focusInput).toHaveBeenCalledTimes(1);
  });

  it("incrementa a quantidade em vez de criar linha duplicada", async () => {
    let state = createSaleDraftState({ number: "PDV-1" });
    const addProduct = (p: PDVProductOption) => {
      const existing = findCartItemByProduct(state.items, p.id);
      state = existing?.ui_key
        ? saleReducer(state, {
            type: "UPDATE_ITEM",
            uiKey: existing.ui_key,
            patch: { quantity: (Number(existing.quantity) || 0) + 1 },
          })
        : saleReducer(state, { type: "ADD_ITEM", item: toCartItem(p, 1) });
    };

    const d = deps([product], { onProduct: addProduct });
    await handleBarcodeScan("7891234567895", d);
    await handleBarcodeScan("7891234567895", d);

    expect(state.items).toHaveLength(1);
    expect(state.items[0].quantity).toBe(2);
  });
});
