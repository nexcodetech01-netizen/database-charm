import { LabelData, LabelaryAudit } from "../types/printing.types";

/**
 * Serviço para interagir com a API do Labelary (https://labelary.com)
 */

let lastAudit: LabelaryAudit | null = null;

export const labelaryService = {
  getLastAudit(): LabelaryAudit | null {
    return lastAudit;
  },

  /**
   * Gera uma URL de imagem do preview da etiqueta (LEGACY)
   */
  getPreviewUrl(label: LabelData): string {
    const { zpl = '', width = 4, height = 6, dpmm = 8 } = label;
    return `https://api.labelary.com/v1/printers/${dpmm}dpmm/labels/${width}x${height}/0/${encodeURIComponent(zpl)}`;
  },

  /**
   * Converte ZPL para PDF usando o Labelary
   */
  async convertToPdf(label: LabelData): Promise<Blob> {
    const { zpl = '', width = 4, height = 6, dpmm = 8 } = label;
    const url = `https://api.labelary.com/v1/printers/${dpmm}dpmm/labels/${width}x${height}/0/`;
    const startTime = Date.now();
    
    const headers = {
      'Accept': 'application/pdf',
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: zpl
      });

      const duration = Date.now() - startTime;
      const responseBody = response.ok ? '' : await response.text();

      lastAudit = {
        url,
        method: 'POST',
        headers,
        zplLength: zpl.length,
        dimensions: `${width}x${height} @ ${dpmm}dpmm`,
        durationMs: duration,
        status: response.status,
        statusText: response.statusText,
        responseBody,
        timestamp: new Date().toISOString()
      };
      
      if (!response.ok) {
        throw new Error(`Labelary error ${response.status}: ${responseBody || 'Unknown error'}`);
      }

      return await response.blob();
    } catch (error) {
      const duration = Date.now() - startTime;
      
      lastAudit = {
        url,
        method: 'POST',
        headers,
        zplLength: zpl.length,
        dimensions: `${width}x${height} @ ${dpmm}dpmm`,
        durationMs: duration,
        status: 0,
        statusText: 'Failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      throw error;
    }
  }
};
