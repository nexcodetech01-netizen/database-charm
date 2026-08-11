import { LabelData, PrintOptions, PrintResult } from "../types/printing.types";

import { PRINT_BRIDGE_URL } from "@/config/print-bridge";

const BRIDGE_URL = PRINT_BRIDGE_URL;

export const printBridgeBrowser = {
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
    
    console.log("[PrintBridgeClient] Iniciando impressão", { jobId: label.id, printer, type: options.type });

    try {
      let endpoint = '/print/raw';
      let body: any = { printer };

      if (label.zpl) {
        console.info("POST /print/image (converted from ZPL)");
        endpoint = '/print/image';
        
        // Obter serviço Labelary dinamicamente
        const { labelaryService } = await import("./labelary.service");
        const blob = await labelaryService.convertToPng(label);
        
        // Converter Blob para Base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        body.image = base64;
      } else if (label.pdf) {
        console.info("POST /print/pdf");
        endpoint = '/print/pdf';
        body.data = label.pdf;
      } else if (label.image) {
        console.info("POST /print/image");
        endpoint = '/print/image';
        body.data = label.image;
      } else if (label.content) {
        body.content = label.content;
      }

      console.log("[PrintBridgeClient] Chamando Print Bridge", { url: `${BRIDGE_URL}${endpoint}` });
      console.log("[PrintBridgeClient] Payload enviado", body);

      const res = await fetch(`${BRIDGE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido no Bridge' }));
        console.error("[PrintBridgeClient] Resposta de erro recebida", { status: res.status, err });
        return { success: false, message: err.error || `Erro ${res.status} na ponte de impressão` };
      }

      const data = await res.json();
      console.info("Resposta recebida", data);
      return { success: true, jobId: data.id };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error('[PrintBridgeClient] Erro detalhado:', e);
      return { success: false, message: `Print Bridge não encontrado ou erro de conexão: ${errorMsg}` };
    }
  }
};
