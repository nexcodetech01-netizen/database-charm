/**
 * Motor de impressão (Sprint 4.0).
 *
 * Estratégia:
 *  1. ESC/POS quando o navegador expõe WebUSB/Web Serial E o usuário optou;
 *  2. fallback SEMPRE garantido para `window.print()` (iframe isolado).
 *
 * Nenhuma regra de negócio: apenas transporte de HTML/bytes para a impressora.
 */
import type { PrintPreferences } from "./print-preferences";

export type PrintMethod = "escpos-usb" | "escpos-serial" | "browser";

export interface PrinterCapabilities {
  /** window.print() disponível. */
  browser: boolean;
  webUsb: boolean;
  webSerial: boolean;
  /** Método que será efetivamente usado. */
  method: PrintMethod;
  /** Rótulo amigável para a UI. */
  label: string;
}

type NavigatorLike =
  | ({ usb?: unknown; serial?: unknown } & Record<string, unknown>)
  | Navigator
  | null
  | undefined;

/**
 * Detecta as capacidades de impressão do ambiente. Puro: recebe o navigator
 * por parâmetro para permitir teste sem DOM.
 */
export function detectPrinterCapabilities(
  nav: NavigatorLike = typeof navigator === "undefined" ? null : navigator,
  prefs?: Pick<PrintPreferences, "preferEscPos"> | null,
): PrinterCapabilities {
  const webUsb = !!nav && typeof nav === "object" && !!(nav as { usb?: unknown }).usb;
  const webSerial =
    !!nav && typeof nav === "object" && !!(nav as { serial?: unknown }).serial;
  const wantsEscPos = !!prefs?.preferEscPos;

  let method: PrintMethod = "browser";
  if (wantsEscPos && webUsb) method = "escpos-usb";
  else if (wantsEscPos && webSerial) method = "escpos-serial";

  const label =
    method === "escpos-usb"
      ? "ESC/POS (USB)"
      : method === "escpos-serial"
        ? "ESC/POS (Serial)"
        : "Impressora do navegador";

  return { browser: true, webUsb, webSerial, method, label };
}

/** Descrição textual da impressora configurada. */
export function describePrinter(
  prefs: Pick<PrintPreferences, "printerName" | "paperWidth">,
  caps: PrinterCapabilities,
): string {
  const name = prefs.printerName?.trim() || "Impressora padrão do sistema";
  return `${name} · ${prefs.paperWidth} · ${caps.label}`;
}

/** CSS de página para o cupom térmico, respeitando largura e margens. */
export function buildThermalPageCss(
  prefs: Pick<PrintPreferences, "paperWidth" | "marginMm">,
): string {
  const width = prefs.paperWidth === "58mm" ? 58 : 80;
  const margin = Math.min(20, Math.max(0, Number(prefs.marginMm) || 0));
  return `@page { size: ${width}mm auto; margin: ${margin}mm; }`;
}

/** ID do <style> injetado dinamicamente para a página térmica. */
export const THERMAL_PAGE_STYLE_ID = "nexos-thermal-page-style";

/**
 * Aplica a regra @page do cupom ao documento atual (usado antes de
 * `window.print()` na área `.receipt-print-area`).
 */
export function applyThermalPageStyle(
  prefs: Pick<PrintPreferences, "paperWidth" | "marginMm">,
  doc: Document | null = typeof document === "undefined" ? null : document,
): void {
  if (!doc) return;
  let el = doc.getElementById(THERMAL_PAGE_STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = doc.createElement("style");
    el.id = THERMAL_PAGE_STYLE_ID;
    doc.head.appendChild(el);
  }
  el.textContent = buildThermalPageCss(prefs);
}

/**
 * Imprime um documento HTML completo em um iframe isolado (etiquetas, DANFE
 * em HTML, etc.). Resolve após disparar o diálogo de impressão.
 */
export async function printHtmlDocument(
  html: string,
  options: { copies?: number } = {},
): Promise<void> {
  console.log("[printer.ts] printHtmlDocument iniciado...");
  if (typeof document === "undefined") {
    console.warn("[printer.ts] printHtmlDocument abortado: document undefined.");
    return;
  }
  const copies = Math.min(5, Math.max(1, Math.round(options.copies ?? 1)));

  for (let i = 0; i < copies; i += 1) {
    await printOnce(html);
  }
}

function printOnce(html: string): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);

    const cleanup = () => {
      window.setTimeout(() => iframe.remove(), 1000);
      resolve();
    };

    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) {
        console.error("[printer.ts] printOnce: contentWindow nulo.");
        cleanup();
        return;
      }

      // 4. Qual é o userAgent do navegador.
      console.log(`[printer.ts] Navigator UserAgent: ${navigator.userAgent}`);

      // 1. Se o evento beforeprint é disparado.
      win.addEventListener("beforeprint", () => {
        console.log("[printer.ts] Evento 'beforeprint' disparado no iframe.");
      });

      // 2. Se o evento afterprint é disparado.
      win.addEventListener("afterprint", () => {
        console.log("[printer.ts] Evento 'afterprint' disparado no iframe.");
      });

      try {
        // 3. Se o iframe recebe focus antes do print().
        win.focus();
        const hasFocus = doc?.hasFocus?.() ?? false; // document do iframe
        const globalFocus = document.hasFocus(); // document principal
        console.log(`[printer.ts] focus() chamado. iframe document.hasFocus: ${win.document.hasFocus()}, root document.hasFocus: ${globalFocus}`);

        console.log("[printer.ts] Disparando window.print() no iframe isolado...");
        
        // 5. Se document.hasFocus() retorna true antes do window.print().
        // (Já logado acima, mas sendo explícito aqui conforme pedido)
        console.log(`[printer.ts] document.hasFocus() antes do print: ${document.hasFocus()}`);

        win.print();
        console.log("[printer.ts] window.print() disparado com sucesso.");
      } catch (err) {
        // 6. Se existe alguma exceção assíncrona após o window.print().
        console.error("[printer.ts] Exceção capturada durante/após window.print():", err);
        throw err;
      }
      cleanup();
    };

    const doc = iframe.contentDocument;
    if (!doc) {
      cleanup();
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
  });
}

/** Abre um PDF (DANFE) em nova janela e dispara a impressão. */
export function printPdfUrl(url: string): void {
  if (typeof window === "undefined") return;
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) return;
  win.addEventListener?.("load", () => {
    try {
      win.focus();
      win.print();
    } catch {
      /* alguns navegadores bloqueiam print() em PDF embutido */
    }
  });
}
