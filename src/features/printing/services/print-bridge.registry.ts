import { LabelData, PrintOptions, PrintResult } from "../types/printing.types";

export interface IPrintBridge {
  health(): Promise<{ status: string; [key: string]: any }>;
  print(label: LabelData, options: PrintOptions): Promise<PrintResult>;
}

class NoopPrintBridge implements IPrintBridge {
  async health() {
    return { status: 'offline', message: 'SSR Noop' };
  }
  async print() {
    return { success: false, message: 'Impressão não disponível no servidor' };
  }
}

let bridgeInstance: IPrintBridge | null = null;

export const getPrintBridge = async (): Promise<IPrintBridge> => {
  if (typeof window === 'undefined') {
    return new NoopPrintBridge();
  }

  if (!bridgeInstance) {
    try {
      const { printBridgeClient } = await import("./print-bridge.client");
      bridgeInstance = printBridgeClient as any;
    } catch (e) {
      console.error('[PrintBridgeRegistry] Failed to load print bridge client', e);
      return new NoopPrintBridge();
    }
  }

  return bridgeInstance as IPrintBridge;
};
