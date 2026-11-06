import QRCode from "qrcode";
/**
 * Etiquetas de produto (Sprint 4.0) — camada PURA.
 *
 * Apenas layout e montagem do HTML de impressão. Nenhuma regra de negócio,
 * nenhum acesso a banco, nenhuma alteração de estoque ou preço.
 */
import { renderCode128Svg, escapeXml } from "./barcode";
import { hasRealBarcode } from "@/features/products/lib/barcode";

export type LabelLayoutId = "40x30" | "40x40" | "50x30" | "58x40";

/** Código impresso: barras (leitor USB) ou QR (câmera do celular). */
export type LabelCodeMode = "barcode" | "qr";

/** QR Code em SVG (síncrono), com 1 módulo de margem. */
export function renderQrSvg(text: string): string {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const total = size + 2;
  let path = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (qr.modules.get(x, y)) path += `M${x + 1} ${y + 1}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

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
  // Tag quadrada de roupa: nome, variação, tamanho em destaque, preço,
  // código de barras do SKU.
  "40x40": {
    id: "40x40",
    label: "40 × 40 mm (tag de roupa)",
    widthMm: 40,
    heightMm: 40,
    barcodeHeightMm: 8,
    namePt: 7,
    skuPt: 5.5,
    pricePt: 11,
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
  /** "Just Do It · Azul" — modelo/estampa e cor (opcional). */
  variant?: string | null;
  /** Tamanho da peça, mostrado em destaque (opcional). */
  size?: string | null;
  /** Data URL do QR Code (opcional). */
  qrCodeDataUrl?: string | null;
}

/**
 * Valor efetivo do código de barras: barcode real > SKU. Marcadores de
 * "sem código" ("SEM GTIN", "ISENTO"...) não viram barras — antes a etiqueta
 * imprimia o código de barras do texto "SEM GTIN".
 */
export function resolveBarcodeValue(item: LabelItem): string | null {
  const real = hasRealBarcode(item.barcode) ? (item.barcode ?? "").trim() : "";
  const value = real || (item.sku ?? "").trim();
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
/** Tira do nome o trecho final " — cor tamanho" quando ele já sai nas outras linhas. */
export function stripVariantSuffix(
  name: string,
  parts: (string | null | undefined)[],
  norm: (v: string) => string,
): string {
  const i = name.lastIndexOf(" — ");
  if (i <= 0) return name;
  const tail = norm(name.slice(i + 3));
  if (!tail) return name;
  const known = ` ${parts.map((p) => norm((p ?? "").replace(/·/g, " "))).join(" ")} `;
  const words = tail.split(" ").filter(Boolean);
  return words.every((w) => known.includes(` ${w} `)) ? name.slice(0, i).trim() : name;
}

export function renderLabelHtml(
  item: LabelItem,
  layout: LabelLayout,
  options: { showQrCode?: boolean; code?: LabelCodeMode } = {},
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

  // Se o nome já traz estampa/cor (botão "Completar nome"), não repete.
  const norm = (v: string) =>
    v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  // "Camiseta … Gucci — Creme Gg": a parte depois do "—" é cor/tamanho, que
  // já saem nas linhas de baixo. Tira do nome para caber em 2 linhas.
  const displayName = stripVariantSuffix(item.name ?? "", [item.variant, item.size], norm);
  const nameNorm = ` ${norm(displayName)} `;
  const variantParts = (item.variant ?? "").split("·").map((p) => p.trim()).filter(Boolean);
  const variantInName =
    variantParts.length > 0 && variantParts.every((p) => nameNorm.includes(` ${norm(p)} `));
  const variant = item.variant?.trim() && !variantInName
    ? `<div class="label-variant">${escapeXml(item.variant.trim())}</div>`
    : "";
  const size = item.size?.trim()
    ? `<div class="label-size">Tam. <strong>${escapeXml(item.size.trim())}</strong></div>`
    : "";
  const head = variant || size
    ? `<div class="label-head"><div class="label-name">${escapeXml(displayName)}</div>${variant}${size}</div>`
    : `<div class="label-name">${escapeXml(displayName)}</div>`;

  if (options.code === "qr" && barcodeValue) {
    return `<div class="label label-${layout.id} label-mode-qr">
  ${head}
  <div class="label-qrrow">
    <div class="label-qrcode">${renderQrSvg(barcodeValue)}</div>
    <div class="label-foot-text">
      <div class="label-sku">${escapeXml(item.sku ?? barcodeValue)}</div>
      ${price}
    </div>
  </div>
</div>`;
  }

  return `<div class="label label-${layout.id}">
  ${head}
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
  /* No máximo 2 linhas inteiras (antes cortava a 3ª no meio). */
  max-height: ${(layout.namePt * 2.3).toFixed(1)}pt;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
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
.label-head { min-width: 0; }
.label-variant { font-size: ${layout.skuPt + 0.5}pt; line-height: 1.15; margin-top: 0.3mm; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.label-size { font-size: ${layout.skuPt + 1}pt; margin-top: 0.4mm; }
.label-size strong { font-size: ${layout.pricePt}pt; }
.label-foot { display: flex; align-items: flex-end; justify-content: space-between; gap: 1.5mm; }
.label-foot-text { min-width: 0; }
.label-sku { font-family: monospace; font-size: ${layout.skuPt}pt; }
.label-price { font-size: ${layout.pricePt}pt; font-weight: 700; }
/* Na tag 40x40 o SKU já sai embaixo das barras: não repete no rodapé. */
.label-40x40 .label-barcode:not(.label-barcode-empty) ~ .label-foot .label-sku { display: none; }
.label-qr { width: ${layout.heightMm / 3}mm; height: ${layout.heightMm / 3}mm; }
.label-qrrow { display: flex; align-items: flex-end; gap: 2mm; }
.label-qrcode { flex: none; width: ${Math.min(layout.heightMm * 0.45, 18).toFixed(1)}mm; height: ${Math.min(layout.heightMm * 0.45, 18).toFixed(1)}mm; }
.label-qrcode svg { display: block; width: 100%; height: 100%; }
.label-mode-qr .label-foot-text { flex: 1; display: flex; flex-direction: column; align-items: flex-end; gap: 0.5mm; }
.label-mode-qr .label-sku { white-space: nowrap; font-size: ${Math.max(layout.skuPt - 0.5, 4.5)}pt; }
`.trim();
}

/** Documento HTML completo com todas as etiquetas do lote. */
export function buildLabelsDocument(
  items: LabelItem[],
  layout: LabelLayout,
  options: { showQrCode?: boolean; title?: string; code?: LabelCodeMode } = {},
): string {
  const body = items.map((it) => renderLabelHtml(it, layout, options)).join("\n");
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<title>${escapeXml(options.title ?? "Etiquetas")}</title>
<style>${buildLabelCss(layout)}</style>
</head><body>${body}</body></html>`;
}
