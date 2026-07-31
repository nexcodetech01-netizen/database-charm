/**
 * Preferências de impressão (Sprint 4.0).
 *
 * Armazenamento local por empresa — mesma estratégia já usada pelas
 * preferências do cupom. Nenhuma alteração de banco.
 */

export type ReceiptPaperWidth = "58mm" | "80mm";

export interface PrintPreferences {
  /** Nome informativo da impressora padrão (o navegador escolhe o device). */
  printerName: string;
  /** Largura do papel térmico. */
  paperWidth: ReceiptPaperWidth;
  /** Margem em milímetros aplicada à página impressa. */
  marginMm: number;
  /** Número de cópias do cupom. */
  copies: number;
  /** Imprime o cupom automaticamente após a venda ser concluída. */
  autoPrintAfterSale: boolean;
  /** Tenta usar ESC/POS quando o navegador suportar (WebUSB/Serial). */
  preferEscPos: boolean;
  /** Layout padrão de etiquetas. */
  labelLayout: string;
}

export const DEFAULT_PRINT_PREFERENCES: PrintPreferences = {
  printerName: "",
  paperWidth: "80mm",
  marginMm: 3,
  copies: 1,
  autoPrintAfterSale: false,
  preferEscPos: false,
  labelLayout: "50x30",
};

const KEY = (companyId: string) => `nexos:print-prefs:${companyId}`;

export function clampCopies(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_PRINT_PREFERENCES.copies;
  return Math.min(5, Math.max(1, n));
}

export function clampMargin(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_PRINT_PREFERENCES.marginMm;
  return Math.min(20, Math.max(0, Math.round(n)));
}

export function normalizePrintPreferences(
  raw: Partial<PrintPreferences> | null | undefined,
): PrintPreferences {
  const merged = { ...DEFAULT_PRINT_PREFERENCES, ...(raw ?? {}) };
  return {
    ...merged,
    printerName: String(merged.printerName ?? "").slice(0, 80),
    paperWidth: merged.paperWidth === "58mm" ? "58mm" : "80mm",
    marginMm: clampMargin(merged.marginMm),
    copies: clampCopies(merged.copies),
    autoPrintAfterSale: !!merged.autoPrintAfterSale,
    preferEscPos: !!merged.preferEscPos,
    labelLayout: String(merged.labelLayout || DEFAULT_PRINT_PREFERENCES.labelLayout),
  };
}

export function getPrintPreferences(companyId: string): PrintPreferences {
  if (typeof window === "undefined") return DEFAULT_PRINT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(KEY(companyId));
    if (!raw) return DEFAULT_PRINT_PREFERENCES;
    return normalizePrintPreferences(JSON.parse(raw) as Partial<PrintPreferences>);
  } catch {
    return DEFAULT_PRINT_PREFERENCES;
  }
}

export function savePrintPreferences(
  companyId: string,
  prefs: PrintPreferences,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    KEY(companyId),
    JSON.stringify(normalizePrintPreferences(prefs)),
  );
}
