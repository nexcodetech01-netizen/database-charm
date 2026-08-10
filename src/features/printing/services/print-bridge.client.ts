import { LabelData, PrintOptions, PrintResult } from "../types/printing.types";

const BRIDGE_URL = "http://127.0.0.1:48555";

export const printBridgeClient = {
  async health() {
    try {
      const res = await fetch(`${BRIDGE_URL}/health`);
      return await res.json();
    } catch (e) {
      return { status: 'offline' };
    }
  },

  async print(label: LabelData, options: PrintOptions): Promise<PrintResult> {
    const printer = options.printerId || 'default';
    
    try {
      let endpoint = '/print/raw';
      let body: any = { printer };

      if (label.zpl) {
        endpoint = '/print/zpl';
        body.zpl = label.zpl;
      } else if (label.pdf) {
        endpoint = '/print/pdf';
        body.data = label.pdf;
      } else if (label.image) {
        endpoint = '/print/image';
        body.data = label.image;
      } else if (label.content) {
        body.content = label.content;
      }

      const res = await fetch(`${BRIDGE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const err = await res.json();
        return { success: false, message: err.error || 'Erro na ponte de impressão' };
      }

      const data = await res.json();
      return { success: true, jobId: data.id };
    } catch (e) {
      console.error('[PrintBridgeClient] Connection error:', e);
      return { success: false, message: 'Print Bridge não encontrado em http://127.0.0.1:48555' };
    }
  }
};
