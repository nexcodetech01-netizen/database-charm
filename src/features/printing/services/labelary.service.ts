import { LabelData } from "../types/printing.types";

/**
 * Serviço para interagir com a API do Labelary (http://labelary.com)
 * Permite converter ZPL para imagem ou PDF para fins de visualização e impressão via browser.
 */
export const labelaryService = {
  /**
   * Gera uma URL de imagem do preview da etiqueta
   */
  getPreviewUrl(label: LabelData): string {
    const { zpl, width = 4, height = 6, dpmm = 8 } = label;
    // O Labelary usa dpmm (8 ou 12)
    // Formato: http://api.labelary.com/v1/printers/{dpmm}dpmm/labels/{width}x{height}/0/
    return `http://api.labelary.com/v1/printers/${dpmm}dpmm/labels/${width}x${height}/0/${encodeURIComponent(zpl)}`;
  },

  /**
   * Converte ZPL para PDF usando o Labelary
   */
  async convertToPdf(label: LabelData): Promise<Blob> {
    const { zpl, width = 4, height = 6, dpmm = 8 } = label;
    const url = `http://api.labelary.com/v1/printers/${dpmm}dpmm/labels/${width}x${height}/0/`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/pdf',
      },
      body: zpl
    });

    if (!response.ok) {
      throw new Error('Falha ao converter ZPL para PDF via Labelary');
    }

    return await response.blob();
  }
};
