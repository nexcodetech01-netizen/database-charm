import { describe, expect, it } from "vitest";
import { labelsFromSelection, toggleIds } from "../label-selection";

describe("etiquetas pela seleção", () => {
  it("marca e desmarca a página", () => {
    let s = toggleIds(new Map(), [{ id: "a", stock: 2 }, { id: "b", stock: "0.000" }], true);
    expect([...s.keys()]).toEqual(["a", "b"]);
    s = toggleIds(s, [{ id: "a" }], false);
    expect([...s.keys()]).toEqual(["b"]);
  });

  it("uma etiqueta por peça em estoque; sem estoque fica de fora", () => {
    const s = toggleIds(new Map(), [
      { id: "a", stock: 3 },
      { id: "b", stock: 0 },
      { id: "c", stock: "1.000" },
    ], true);
    const r = labelsFromSelection(s);
    expect(r.initial).toEqual([
      { productId: "a", quantity: 3 },
      { productId: "c", quantity: 1 },
    ]);
    expect(r.labels).toBe(4);
    expect(r.withoutStock).toBe(1);
  });
});
