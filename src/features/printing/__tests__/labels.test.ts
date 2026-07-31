import { describe, expect, it } from "vitest";
import {
  LABEL_LAYOUTS,
  buildLabelCss,
  buildLabelsDocument,
  expandLabelCopies,
  renderLabelHtml,
  resolveBarcodeValue,
  resolveLabelLayout,
} from "../lib/labels";

const item = {
  name: "Caneta Azul",
  sku: "CAN-001",
  barcode: "7891234567895",
  price: 4.5,
};

describe("Etiquetas", () => {
  it("expõe os três layouts obrigatórios", () => {
    expect(Object.keys(LABEL_LAYOUTS).sort()).toEqual([
      "40x30",
      "50x30",
      "58x40",
    ]);
    expect(LABEL_LAYOUTS["40x30"].widthMm).toBe(40);
    expect(LABEL_LAYOUTS["58x40"].heightMm).toBe(40);
  });

  it("faz fallback para 50x30 em layout desconhecido", () => {
    expect(resolveLabelLayout("99x99").id).toBe("50x30");
    expect(resolveLabelLayout(null).id).toBe("50x30");
    expect(resolveLabelLayout("58x40").id).toBe("58x40");
  });

  it("usa barcode e cai para o SKU quando ausente", () => {
    expect(resolveBarcodeValue(item)).toBe("7891234567895");
    expect(resolveBarcodeValue({ ...item, barcode: null })).toBe("CAN-001");
    expect(resolveBarcodeValue({ name: "X" })).toBeNull();
  });

  it("expande cópias com limites de 1 a 200", () => {
    expect(expandLabelCopies(item, 3)).toHaveLength(3);
    expect(expandLabelCopies(item, 0)).toHaveLength(1);
    expect(expandLabelCopies(item, -5)).toHaveLength(1);
    expect(expandLabelCopies(item, 5000)).toHaveLength(200);
  });

  it("renderiza nome, SKU, preço e código de barras", () => {
    const html = renderLabelHtml(item, LABEL_LAYOUTS["50x30"]);
    expect(html).toContain("Caneta Azul");
    expect(html).toContain("CAN-001");
    expect(html).toContain("<svg");
    expect(html).toMatch(/R\$\s?4,50/);
  });

  it("indica ausência de código quando não há barcode nem SKU", () => {
    const html = renderLabelHtml({ name: "Sem código" }, LABEL_LAYOUTS["40x30"]);
    expect(html).toContain("sem código");
    expect(html).not.toContain("<svg");
  });

  it("só inclui QR Code em layouts que suportam e quando solicitado", () => {
    const withQr = { ...item, qrCodeDataUrl: "data:image/png;base64,AAA" };
    expect(
      renderLabelHtml(withQr, LABEL_LAYOUTS["58x40"], { showQrCode: true }),
    ).toContain("label-qr");
    expect(
      renderLabelHtml(withQr, LABEL_LAYOUTS["40x30"], { showQrCode: true }),
    ).not.toContain("label-qr");
    expect(renderLabelHtml(withQr, LABEL_LAYOUTS["58x40"])).not.toContain(
      "label-qr",
    );
  });

  it("escapa HTML no nome do produto", () => {
    const html = renderLabelHtml(
      { name: '<img onerror="x">' },
      LABEL_LAYOUTS["50x30"],
    );
    expect(html).not.toContain("<img onerror");
    expect(html).toContain("&lt;img");
  });

  it("gera @page com as dimensões do layout", () => {
    expect(buildLabelCss(LABEL_LAYOUTS["58x40"])).toContain(
      "@page { size: 58mm 40mm; margin: 0; }",
    );
  });

  it("monta o documento completo com uma etiqueta por cópia", () => {
    const doc = buildLabelsDocument(
      expandLabelCopies(item, 3),
      LABEL_LAYOUTS["40x30"],
    );
    expect(doc.startsWith("<!doctype html>")).toBe(true);
    expect(doc.split('class="label label-40x30"').length - 1).toBe(3);
  });
});
