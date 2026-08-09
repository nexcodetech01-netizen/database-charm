import { LabelData, LabelaryAudit } from "../types/printing.types";
import CryptoJS from 'crypto-js';

/**
 * Serviço para interagir com a API do Labelary (https://labelary.com)
 * Com Cache por Hash ZPL e Auditoria Técnica.
 */

let lastAudit: LabelaryAudit | null = null;
const cache = new Map<string, Blob>();

export const labelaryService = {
  getLastAudit(): LabelaryAudit | null {
    return lastAudit;
  },

  /**
   * Converte ZPL para PDF usando o Labelary com cache e métricas
   */
  async convertToPdf(label: LabelData): Promise<Blob> {
    const { zpl = '', width = 4, height = 6, dpmm = 8 } = label;
    
    // 1. Check Cache
    const cacheKey = CryptoJS.MD5(`${zpl}|${width}|${height}|${dpmm}`).toString();
    if (cache.has(cacheKey)) {
      console.log(`[Labelary] Cache hit for ZPL hash: ${cacheKey}`);
      // Atualiza auditoria para refletir cache hit
      lastAudit = {
        url: 'cache://local',
        method: 'GET',
        headers: {},
        zplLength: zpl.length,
        dimensions: `${width}x${height} @ ${dpmm}dpmm`,
        durationMs: 0,
        parseDurationMs: 0,
        status: 200,
        statusText: 'OK (Cache)',
        timestamp: new Date().toISOString(),
        cacheHit: true
      };
      return cache.get(cacheKey)!;
    }

    const url = `https://api.labelary.com/v1/printers/${dpmm}dpmm/labels/${width}x${height}/0/`;
    const startTime = Date.now();
    const parseStart = performance.now();
    
    // Simulação de tempo de parse
    const parseTime = performance.now() - parseStart;
    
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
        parseDurationMs: parseTime,
        status: response.status,
        statusText: response.statusText,
        responseBody,
        timestamp: new Date().toISOString(),
        cacheHit: false
      };
      
      console.log(`[Labelary] Request completed in ${duration}ms. Status: ${response.status}`);
      
      if (!response.ok) {
        if (response.status === 429) {
           console.warn("[Labelary] Rate limit exceeded (429)");
        }
        throw new Error(`Labelary error ${response.status}: ${responseBody || 'Unknown error'}`);
      }

      const blob = await response.blob();
      
      // Save to cache
      cache.set(cacheKey, blob);
      
      return blob;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      lastAudit = {
        url,
        method: 'POST',
        headers,
        zplLength: zpl.length,
        dimensions: `${width}x${height} @ ${dpmm}dpmm`,
        durationMs: duration,
        parseDurationMs: parseTime,
        status: lastAudit?.status || 0,
        statusText: lastAudit?.statusText || 'Failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        cacheHit: false
      };
      
      console.error(`[Labelary] Critical failure in ${duration}ms:`, error);
      throw error;
    }
  }
};
