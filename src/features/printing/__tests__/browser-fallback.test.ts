import { describe, expect, it, vi } from "vitest";

vi.mock("../services/printer.service", () => ({
  printerService: { checkHealth: async () => false, listPrinters: async () => [] },
}));
const printInBrowser = vi.fn(async () => ({ success: true, jobId: "browser" }));
vi.mock("../services/browser-print", () => ({ printInBrowser: (...a: unknown[]) => printInBrowser(...(a as [])) }));

describe("Print Bridge desligado", () => {
  it("abre a impressão do navegador em vez de dar erro", async () => {
    const { printManager } = await import("../services/print.service");
    const r = await printManager.printAndWait({ id: "x", zpl: "^XA^XZ" }, { strategy: "RAW", type: "LABEL" } as never);
    expect(r).toMatchObject({ success: true, jobId: "browser" });
    expect(printInBrowser).toHaveBeenCalledTimes(1);
  });
});
