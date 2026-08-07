import { LabelData, PrintOptions, PrintResult } from "../types/printing.types";
import { labelaryService } from "./labelary.service";

/**
 * Interface base para estratégias de impressão
 */
export interface PrintingStrategy {
  print(label: LabelData, options: PrintOptions): Promise<PrintResult>;
}

/**
 * Estratégia de impressão via PDF (converte ZPL e imprime o PDF)
 */
class PdfPrintingStrategy implements PrintingStrategy {
  async print(label: LabelData, options: PrintOptions): Promise<PrintResult> {
    try {
      const pdfBlob = await labelaryService.convertToPdf(label);
      const url = URL.createObjectURL(pdfBlob);
      
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);
      
      return new Promise((resolve) => {
        iframe.onload = () => {
          iframe.contentWindow?.print();
          // Remove o iframe após um tempo para garantir que a impressão foi disparada
          setTimeout(() => {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(url);
            resolve({ success: true });
          }, 1000);
        };
      });
    } catch (error) {
      console.error('Erro na estratégia PDF:', error);
      return { 
        success: false, 
        message: 'Erro ao gerar ou imprimir PDF',
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
}

/**
 * Estratégia de impressão via Navegador (Imprime conteúdo HTML/Texto)
 */
class BrowserPrintingStrategy implements PrintingStrategy {
  async print(label: LabelData, options: PrintOptions): Promise<PrintResult> {
    // Para simplificar na Sprint 1, usamos a mesma lógica do PDF ou abrimos uma nova aba
    const pdfBlob = await labelaryService.convertToPdf(label);
    const url = URL.createObjectURL(pdfBlob);
    window.open(url, '_blank');
    return { success: true };
  }
}

/**
 * Serviço central de impressão
 */
export const printService = {
  async print(label: LabelData, options: PrintOptions): Promise<PrintResult> {
    let strategy: PrintingStrategy;

    switch (options.strategy) {
      case 'PDF':
        strategy = new PdfPrintingStrategy();
        break;
      case 'BROWSER':
        strategy = new BrowserPrintingStrategy();
        break;
      case 'ZPL':
      case 'RAW':
        // RAW será implementado no futuro
        return { success: false, message: 'Estratégia RAW/ZPL ainda não implementada' };
      default:
        strategy = new PdfPrintingStrategy();
    }

    return await strategy.print(label, options);
  },

  downloadZpl(label: LabelData) {
    const blob = new Blob([label.zpl], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `etiqueta-${label.id}.zpl`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async downloadPdf(label: LabelData) {
    const blob = await labelaryService.convertToPdf(label);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `etiqueta-${label.id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }
};
