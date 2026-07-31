/**
 * PDV — Leitura de código de barras (Sprint 2.7).
 *
 * Camada pura: só normaliza a sequência digitada pelo leitor (USB keyboard
 * wedge) e escolhe o produto a partir do resultado da busca existente
 * (`applyProductSearch`). Nenhuma busca nova, nenhuma regra de produto
 * duplicada, nenhum cálculo — o carrinho continua sendo do SaleEngine/reducer.
 */
import type { PDVProductOption } from "../types";

/** Limpa a sequência lida (leitores enviam espaços/quebras acidentais). */
export function normalizeBarcode(raw: string): string {
  return (raw ?? "").replace(/[\r\n\t]/g, "").trim();
}

/** Formatos aceitos sem alterar o mecanismo de busca: EAN-13/8, UPC ou SKU. */
export function isScannableCode(code: string): boolean {
  const value = normalizeBarcode(code);
  if (value.length < 3) return false;
  return /^[A-Za-z0-9._/-]+$/.test(value);
}

/** `true` quando a sequência é puramente numérica de EAN-8/UPC-A/EAN-13. */
export function isNumericBarcode(code: string): boolean {
  const value = normalizeBarcode(code);
  return /^\d+$/.test(value) && [8, 12, 13, 14].includes(value.length);
}

/**
 * Escolhe o produto de uma leitura. Preferência por correspondência exata de
 * código de barras, depois SKU; um único resultado também é aceito.
 */
export function pickScannedProduct(
  code: string,
  options: (PDVProductOption & { barcode?: string | null })[],
): PDVProductOption | null {
  const value = normalizeBarcode(code).toLowerCase();
  if (!value || options.length === 0) return null;

  const byBarcode = options.find(
    (p) => (p.barcode ?? "").trim().toLowerCase() === value,
  );
  if (byBarcode) return byBarcode;

  const bySku = options.find(
    (p) => (p.sku ?? "").trim().toLowerCase() === value,
  );
  if (bySku) return bySku;

  return options.length === 1 ? options[0] : null;
}

export type BarcodeScanDeps = {
  /** Busca existente do PDV (`applyProductSearch` sobre `products`). */
  lookup: (
    code: string,
  ) => Promise<(PDVProductOption & { barcode?: string | null })[]>;
  /** Adiciona/incrementa no carrinho — `usePDV.addProduct` (reducer). */
  onProduct: (product: PDVProductOption) => void;
  /** Aviso ao operador quando nada é encontrado. */
  onNotFound: (message: string) => void;
  /** Limpa o buffer do campo de leitura. */
  clearBuffer: () => void;
  /** Devolve o foco ao campo de leitura. */
  focusInput: () => void;
};

export type BarcodeScanResult =
  | { status: "added"; product: PDVProductOption }
  | { status: "not_found" }
  | { status: "ignored" };

export const BARCODE_NOT_FOUND_MESSAGE = "Produto não encontrado.";

/**
 * Processa uma leitura completa (ENTER). O buffer é sempre limpo e o foco
 * sempre volta ao campo, com ou sem produto encontrado.
 */
export async function handleBarcodeScan(
  raw: string,
  deps: BarcodeScanDeps,
): Promise<BarcodeScanResult> {
  const code = normalizeBarcode(raw);
  if (!isScannableCode(code)) return { status: "ignored" };

  try {
    const options = await deps.lookup(code);
    const product = pickScannedProduct(code, options);
    if (!product) {
      deps.onNotFound(BARCODE_NOT_FOUND_MESSAGE);
      return { status: "not_found" };
    }
    // Incremento de quantidade é responsabilidade do reducer do PDV
    // (`addProduct` reaproveita a linha existente do mesmo produto).
    deps.onProduct(product);
    return { status: "added", product };
  } finally {
    deps.clearBuffer();
    deps.focusInput();
  }
}
