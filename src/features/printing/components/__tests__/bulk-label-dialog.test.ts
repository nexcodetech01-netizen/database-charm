import { describe, expect, it } from "vitest";
import { BULK_LABEL_MAX, expandBulkLabels, toLabelItem } from "../bulk-label-dialog";

const p = (name: string) =>
  toLabelItem({
    id: name,
    name,
    sku: "SKU",
    barcode: null,
    price: 10,
    model: null,
    color: "Azul",
    size: "M",
    stock: 3,
  });

describe("etiquetas em lote", () => {
  it("repete cada produto pela quantidade", () => {
    const out = expandBulkLabels([
      { item: p("A"), quantity: 2 },
      { item: p("B"), quantity: 3 },
      { item: p("C"), quantity: 0 },
    ]);
    expect(out.map((i) => i.name)).toEqual(["A", "A", "B", "B", "B"]);
  });

  it("respeita o máximo por impressão", () => {
    expect(expandBulkLabels([{ item: p("A"), quantity: 9999 }])).toHaveLength(BULK_LABEL_MAX);
  });

  it("leva cor e tamanho para a etiqueta", () => {
    expect(p("A")).toMatchObject({ size: "M", sku: "SKU", price: 10 });
  });
});
