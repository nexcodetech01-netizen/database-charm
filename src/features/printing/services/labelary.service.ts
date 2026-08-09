import { LabelData } from "../types/printing.types";

/**
 * Serviço para interagir com a API do Labelary (https://labelary.com)
 * Permite converter ZPL para imagem ou PDF para fins de visualização e impressão via browser.
 */
export const labelaryService = {
  /**
   * Converte ZPL para PDF usando o Labelary
   * Auditoria Enterprise: Garantir HTTPS, Content-Type correto e payload bruto.
   */
  async convertToPdf(label: LabelData): Promise<Blob> {
    const { zpl = '', width = 4, height = 6, dpmm = 8 } = label;
    // URL format: https://api.labelary.com/v1/printers/{dpmm}dpmm/labels/{width}x{height}/0/
    const url = `https://api.labelary.com/v1/printers/${dpmm}dpmm/labels/${width}x${height}/0/`;
    const startTime = Date.now();
    
    console.log(`[Labelary.Request] ${url}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/pdf',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      zplLength: zpl.length
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/pdf',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: zpl // O Labelary espera o ZPL bruto no body quando Content-Type é x-www-form-urlencoded
      });

      const duration = Date.now() - startTime;
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Labelary.Error] Status: ${response.status} (${duration}ms)`, {
          body: errorText,
          url
        });
        throw new Error(`Labelary error ${response.status}: ${errorText || 'Unknown error'}`);
      }

      console.log(`[Labelary.Success] ${response.status} (${duration}ms)`);
      return await response.blob();
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[Labelary.Fatal] ${error instanceof Error ? error.message : 'Unknown error'} (${duration}ms)`, {
        url
      });
      throw error;
    }
  }
};
