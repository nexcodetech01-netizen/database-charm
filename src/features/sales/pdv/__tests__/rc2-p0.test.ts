/**
 * RC2 — Testes dos bloqueadores P0 do PDV.
 */
import { describe, it, expect } from "vitest";
import {
  createPdvShortcutHandler,
  isPdvOwnedKey,
} from "../hooks/use-pdv-shortcuts";
import { buildCatalogIndex, EMPTY_CATALOG_INDEX } from "../lib/catalog-index";
import { pdvSessionReducer, PDV_SESSION_INITIAL } from "../lib/completion";

type Ev = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  prevented?: boolean;
  preventDefault?: () => void;
};

function ev(key: string, extra: Partial<Ev> = {}): Ev {
  const e: Ev = { key, ...extra };
  e.preventDefault = () => {
    e.prevented = true;
  };
  return e;
}

describe("P0.1 — atalhos nunca vazam para o navegador", () => {
  for (const key of ["F2", "F3", "F4", "F5"]) {
    it(`bloqueia ${key} mesmo sem handler disponível`, () => {
      const handler = createPdvShortcutHandler(() => ({}));
      const e = ev(key);
      handler(e as never);
      expect(e.prevented).toBe(true);
    });
  }

  it("bloqueia CTRL+L mesmo sem handler", () => {
    const handler = createPdvShortcutHandler(() => ({}));
    const e = ev("l", { ctrlKey: true });
    handler(e as never);
    expect(e.prevented).toBe(true);
  });

  it("executa a ação quando o handler existe", () => {
    let called = 0;
    const handler = createPdvShortcutHandler(() => ({
      "open-payment": () => {
        called += 1;
      },
    }));
    const e = ev("F5");
    handler(e as never);
    expect(e.prevented).toBe(true);
    expect(called).toBe(1);
  });

  it("não interfere em teclas alheias ao PDV", () => {
    const handler = createPdvShortcutHandler(() => ({}));
    const e = ev("a");
    handler(e as never);
    expect(e.prevented).toBeUndefined();
    expect(isPdvOwnedKey(e as never)).toBe(false);
  });
});

describe("P0.3 — pagamento assíncrono não depende do diálogo", () => {
  const sale = { id: "s1", number: "1", total: 100 } as never;

  it("conclui a venda mesmo com o checkout fechado", () => {
    let state = pdvSessionReducer(PDV_SESSION_INITIAL, {
      type: "SALE_CREATED",
      sale,
    });
    state = pdvSessionReducer(state, { type: "CLOSE_CHECKOUT" });
    expect(state.pendingSale).toBeNull();
    expect(state.lastSale).not.toBeNull();

    state = pdvSessionReducer(state, {
      type: "SALE_RECEIVED",
      paymentMethod: "pix",
      receivedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(state.completed?.id).toBe("s1");
    expect(state.completed?.paymentMethod).toBe("pix");
  });

  it("ignora confirmação duplicada", () => {
    let state = pdvSessionReducer(PDV_SESSION_INITIAL, {
      type: "SALE_CREATED",
      sale,
    });
    state = pdvSessionReducer(state, {
      type: "SALE_RECEIVED",
      paymentMethod: "pix",
    });
    const first = state.completed;
    state = pdvSessionReducer(state, {
      type: "SALE_RECEIVED",
      paymentMethod: "cash",
    });
    expect(state.completed).toBe(first);
  });

  it("nova venda limpa a referência", () => {
    let state = pdvSessionReducer(PDV_SESSION_INITIAL, {
      type: "SALE_CREATED",
      sale,
    });
    state = pdvSessionReducer(state, { type: "NEW_SALE" });
    expect(state.lastSale).toBeNull();
  });
});

describe("P0.4 — índice local do catálogo", () => {
  const products = [
    {
      id: "p1",
      name: "Bolsa",
      sku: "BLS-1",
      barcode: "7891234567895",
      reference: "REF1",
      price: 100,
      cost: null,
      stock: 3,
      unit: null,
    },
    {
      id: "p2",
      name: "Carteira",
      sku: "CRT-2",
      barcode: null,
      reference: null,
      price: 50,
      cost: null,
      stock: 1,
      unit: null,
    },
  ];
  const index = buildCatalogIndex(products as never);

  it("resolve por código de barras", () => {
    expect(index.match("7891234567895")?.id).toBe("p1");
  });

  it("resolve por SKU e referência, sem depender de caixa alta", () => {
    expect(index.match("crt-2")?.id).toBe("p2");
    expect(index.match("ref1")?.id).toBe("p1");
  });

  it("não resolve termos parciais ou desconhecidos", () => {
    expect(index.match("Bols")).toBeNull();
    expect(index.match("000")).toBeNull();
    expect(index.match("")).toBeNull();
  });

  it("índice vazio nunca casa", () => {
    expect(EMPTY_CATALOG_INDEX.match("7891234567895")).toBeNull();
  });
});
