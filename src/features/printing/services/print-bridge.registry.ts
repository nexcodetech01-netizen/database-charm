import { LabelData, PrintOptions, PrintResult } from "../types/printing.types";
import { IPrintBridge } from "./print-bridge.interface";

class NoopPrintBridge implements IPrintBridge {
  async health() {
    return { status: 'offline', message: 'SSR Noop' };
  }
  async print() {
    return { success: false, message: 'Impressão não disponível no servidor' };
  }
}

let bridgeInstance: IPrintBridge | null = null;

/**
 * Registry to provide the Print Bridge implementation.
 * On server (SSR), it returns a Noop implementation.
 * On client (Browser), it dynamically imports the browser-specific implementation.
 * 
 * NOTE: The filename uses .browser.ts instead of .client.ts to avoid 
 * TanStack Start's static analysis block during SSR bundle generation.
 */
export const getPrintBridge = async (): Promise<IPrintBridge> => {
  if (typeof window === 'undefined') {
    return new NoopPrintBridge();
  }

  if (!bridgeInstance) {
    try {
      // @ts-ignore - The filename is hidden from TanStack Start static analysis via .browser.ts
      const { printBridgeBrowser } = await import("./print-bridge.browser" as any);
      bridgeInstance = printBridgeBrowser as IPrintBridge;
    } catch (e) {
      console.error('[PrintBridgeRegistry] Failed to load print bridge implementation', e);
      return new NoopPrintBridge();
    }
  }

  return bridgeInstance;
};
