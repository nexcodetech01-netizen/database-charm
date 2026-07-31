/**
 * Etiquetas de produto (Sprint 4.0) — camada PURA.
 *
 * Apenas layout e montagem do HTML de impressão. Nenhuma regra de negócio,
 * nenhum acesso a banco, nenhuma alteração de estoque ou preço.
 */
import { renderCode128Svg, escapeXml } from "./barcode";

export type LabelLayoutId = "40x30" | "50x30" | "58x40";

export interface LabelLayout {
  id: LabelLayoutId;
  label: string;
  widthMm: number;
  heightMm: number;
  /** Altura reservada às barras. */
  barcodeHeightMm: number;
  namePt: number;
  skuPt: number;
  pricePt: number;
  /** Espaço suficiente para QR Code opcional. */
  supportsQrCode: boolean;
}

export const LABEL_LAYOUTS: Record<LabelLayoutId, LabelLayout> = {
  "40x30": {
    id: "40x30",
    label: "40 × 30 mm",
    widthMm: 40,
    heightMm: 30,
    barcodeHeightMm: 9,
    namePt: 6.5,
    skuPt: 5.5,
    pricePt: 9,
    supportsQrCode: false,
  },
  "50x30": {
    id: "50x30",
    label: "50 × 30 mm",
    widthMm: 50,
    heightMm: 30,
    barcodeHeightMm: 10,
    namePt: 7,
    skuPt: 6,
    pricePt: 10,
    supportsQrCode: true,
  },
  "58x40": {
    id: "58x40",
    label: "58 × 40 mm",
    widthMm: 58,
    heightMm: 40,
    barcodeHeightMm: 13,
    namePt: 8,
    skuPt: 6.5,
    pricePt: 12,
    supportsQrCode: true,
  },
};

export const LABEL_LAYOUT_LIST: LabelLayout[] = Object.values(LABEL_LAYOUTS);

export function resolveLabelLayout(id: string | null | undefined): LabelLayout {
  return LABEL_LAYOUTS[(id ?? "") as LabelLayoutId] ?? LABEL_LAYOUTS["50x30"];
}

export interface LabelItem {
  name: string;
  sku?: string | null;
  barcode?: string | null;
  price?: number | null;
  /** Data URL do QR Code (opcional). */
  qrCodeDataUrl?: string | null;
}

/** Valor efetivo do código de barras: barcode > SKU. */
export function resolveBarcodeValue(item: LabelItem): string | null {
  const value = (item.barcode || item.sku || "").trim();
  return value ? value : null;
}

/** Expande um item em N cópias (mínimo 1, máximo 200 por lote). */
export function expandLabelCopies(item: LabelItem, copies: number): LabelItem[] {
  const n = Math.min(200, Math.max(1, Math.round(Number(copies) || 1)));
  return Array.from({ length: n }, () => item);
}

function formatPriceBR(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** HTML de uma etiqueta individual. */
export function renderLabelHtml(
  item: LabelItem,
  layout: LabelLayout,
  options: { showQrCode?: boolean } = {},
): string {
  const barcodeValue = resolveBarcodeValue(item);
  const barcode = barcodeValue
    ? `<div class="label-barcode">${renderCode128Svg(barcodeValue, { height: 40, displayValue: true })}</div>`
    : `<div class="label-barcode label-barcode-empty">sem código</div>`;

  const showQr =
    !!options.showQrCode && layout.supportsQrCode && !!item.qrCodeDataUrl;
  const qr = showQr
    ? `<img class="label-qr" src="${escapeXml(item.qrCodeDataUrl!)}" alt="" />`
    : "";

  const price =
    item.price != null && Number.isFinite(Number(item.price))
      ? `<div class="label-price">${formatPriceBR(Number(item.price))}</div>`
      : "";

  return `<div class="label label-${layout.id}">
  <div class="label-name">${escapeXml(item.name ?? "")}</div>
  ${barcode}
  <div class="label-foot">
    <div class="label-foot-text">
      <div class="label-sku">${escapeXml(item.sku ?? "")}</div>
      ${price}
    </div>
    ${qr}
  </div>
</div>`;
}

/** CSS específico das etiquetas (usado no documento de impressão). */
export function buildLabelCss(layout: LabelLayout): string {
  return `
@page { size: ${layout.widthMm}mm ${layout.heightMm}mm; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
.label {
  width: ${layout.widthMm}mm;
  height: ${layout.heightMm}mm;
  box-sizing: border-box;
  padding: 1.5mm 2mm;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-family: Arial, Helvetica, sans-serif;
  color: #000;
  overflow: hidden;
  page-break-after: always;
  break-after: page;
}
.label:last-child { page-break-after: auto; break-after: auto; }
.label-name {
  font-size: ${layout.namePt}pt;
  font-weight: 700;
  line-height: 1.15;
  max-height: ${layout.namePt * 2.6}pt;
  overflow: hidden;
}
.label-barcode { height: ${layout.barcodeHeightMm}mm; }
.label-barcode svg { display: block; width: 100%; height: 100%; }
.label-barcode-empty {
  font-size: ${layout.skuPt}pt;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed #000;
}
.label-foot { display: flex; align-items: flex-end; justify-content: space-between; gap: 1.5mm; }
.label-foot-text { min-width: 0; }
.label-sku { font-family: monospace; font-size: ${layout.skuPt}pt; }
.label-price { font-size: ${layout.pricePt}pt; font-weight: 700; }
.label-qr { width: ${layout.heightMm / 3}mm; height: ${layout.heightMm / 3}mm; }
`.trim();
}

/** Documento HTML completo com todas as etiquetas do lote. */
export function buildLabelsDocument(
  items: LabelItem[],
  layout: LabelLayout,
  options: { showQrCode?: boolean; title?: string } = {},
): string {
  const body = items.map((it) => renderLabelHtml(it, layout, options)).join("\n");
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<title>${escapeXml(options.title ?? "Etiquetas")}</title>
<style>${buildLabelCss(layout)}</style>
</head><body>${body}</body></html>`;
}
