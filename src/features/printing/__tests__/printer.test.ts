import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRINT_PREFERENCES,
  clampCopies,
  clampMargin,
  normalizePrintPreferences,
} from "../lib/print-preferences";
import {
  buildThermalPageCss,
  describePrinter,
  detectPrinterCapabilities,
} from "../lib/printer";

describe("Preferências de impressão", () => {
  it("limita cópias entre 1 e 5", () => {
    expect(clampCopies(0)).toBe(1);
    expect(clampCopies(3)).toBe(3);
    expect(clampCopies(99)).toBe(5);
    expect(clampCopies("abc")).toBe(DEFAULT_PRINT_PREFERENCES.copies);
  });

  it("limita margens entre 0 e 20 mm", () => {
    expect(clampMargin(-4)).toBe(0);
    expect(clampMargin(7.4)).toBe(7);
    expect(clampMargin(100)).toBe(20);
  });

  it("normaliza entradas inválidas para os defaults", () => {
    const prefs = normalizePrintPreferences({
      paperWidth: "invalid" as never,
      copies: 42,
      marginMm: -1,
      labelLayout: "",
    });
    expect(prefs.paperWidth).toBe("80mm");
    expect(prefs.copies).toBe(5);
    expect(prefs.marginMm).toBe(0);
    expect(prefs.labelLayout).toBe("50x30");
    expect(prefs.autoPrintAfterSale).toBe(false);
  });

  it("preserva valores válidos", () => {
    const prefs = normalizePrintPreferences({
      paperWidth: "58mm",
      copies: 2,
      marginMm: 5,
      autoPrintAfterSale: true,
      printerName: "Epson TM-T20",
    });
    expect(prefs).toMatchObject({
      paperWidth: "58mm",
      copies: 2,
      marginMm: 5,
      autoPrintAfterSale: true,
      printerName: "Epson TM-T20",
    });
  });
});

describe("Detecção de impressora", () => {
  it("usa o navegador quando ESC/POS não é solicitado", () => {
    const caps = detectPrinterCapabilities({ usb: {} }, { preferEscPos: false });
    expect(caps.method).toBe("browser");
    expect(caps.webUsb).toBe(true);
    expect(caps.browser).toBe(true);
  });

  it("usa ESC/POS via USB quando disponível e solicitado", () => {
    const caps = detectPrinterCapabilities({ usb: {} }, { preferEscPos: true });
    expect(caps.method).toBe("escpos-usb");
  });

  it("cai para serial quando não há WebUSB", () => {
    const caps = detectPrinterCapabilities({ serial: {} }, { preferEscPos: true });
    expect(caps.method).toBe("escpos-serial");
  });

  it("faz fallback para o navegador sem suporte algum", () => {
    const caps = detectPrinterCapabilities(null, { preferEscPos: true });
    expect(caps.method).toBe("browser");
    expect(caps.label).toBe("Impressora do navegador");
  });

  it("descreve a impressora configurada", () => {
    const caps = detectPrinterCapabilities(null, null);
    expect(describePrinter({ printerName: "", paperWidth: "58mm" }, caps)).toContain(
      "Impressora padrão do sistema",
    );
    expect(
      describePrinter({ printerName: "Bematech", paperWidth: "80mm" }, caps),
    ).toBe("Bematech · 80mm · Impressora do navegador");
  });
});

describe("CSS de página térmica", () => {
  it("respeita largura e margem", () => {
    expect(buildThermalPageCss({ paperWidth: "58mm", marginMm: 3 })).toBe(
      "@page { size: 58mm auto; margin: 3mm; }",
    );
    expect(buildThermalPageCss({ paperWidth: "80mm", marginMm: 999 })).toBe(
      "@page { size: 80mm auto; margin: 20mm; }",
    );
  });
});
