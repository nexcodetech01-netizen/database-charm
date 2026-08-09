import { LabelData, LabelaryAudit } from "../types/printing.types";
import CryptoJS from 'crypto-js';
import { openDB, IDBPDatabase } from 'idb';

/**
 * Interface para o banco de dados de cache
 */
interface LabelCacheDB {
  previews: {
    key: string;
    value: {
      hash: string;
      blob: Blob;
      timestamp: number;
    };
  };
}

/**
 * Serviço para interagir com a API do Labelary (https://labelary.com)
 * Com Cache Permanente (IndexedDB), Fila de Concorrência e Rate Limiter.
 */

let lastAudit: LabelaryAudit | null = null;
const memoryCache = new Map<string, Blob>();
let dbPromise: Promise<IDBPDatabase<LabelCacheDB>> | null = null;

// Fila de requisições para controle de concorrência e rate limiter
let isProcessing = false;
const queue: Array<{
  label: LabelData;
  resolve: (value: Blob) => void;
  reject: (reason: any) => void;
}> = [];

const RATE_LIMIT_MS = 1000; // 1 requisição por segundo

/**
 * Inicializa o banco de dados IndexedDB
 */
function getDB() {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB<LabelCacheDB>('nexos-labelary-cache', 1, {
      upgrade(db) {
        db.createObjectStore('previews', { keyPath: 'hash' });
      },
    });
  }
  return dbPromise;
}

export const labelaryService = {
  getLastAudit(): LabelaryAudit | null {
    return lastAudit;
  },

  /**
   * Converte ZPL para PDF usando o Labelary com cache permanente e resiliência
   */
  async convertToPdf(label: LabelData): Promise<Blob> {
    const { zpl = '', width = 4, height = 6, dpmm = 8 } = label;
    const cacheKey = CryptoJS.SHA256(`${zpl}|${width}|${height}|${dpmm}`).toString();

    // 1. Check Memory Cache
    if (memoryCache.has(cacheKey)) {
      console.log(`[Labelary] Memory cache hit: ${cacheKey}`);
      this.updateAuditForCache(label, true, 'Memory');
      return memoryCache.get(cacheKey)!;
    }

    // 2. Check Permanent Cache (IndexedDB)
    const db = await getDB();
    if (db) {
      const startTime = performance.now();
      const cached = await db.get('previews', cacheKey);
      if (cached) {
        const cacheDuration = performance.now() - startTime;
        console.log(`[Labelary] IndexedDB cache hit: ${cacheKey} (${cacheDuration.toFixed(2)}ms)`);
        memoryCache.set(cacheKey, cached.blob);
        this.updateAuditForCache(label, true, 'IndexedDB', cacheDuration);
        return cached.blob;
      }
    }

    // 3. Queue request if not in cache
    return new Promise((resolve, reject) => {
      queue.push({ label, resolve, reject });
      this.processQueue();
    });
  },

  updateAuditForCache(label: LabelData, hit: boolean, type: string, cacheTime: number = 0) {
    const { zpl = '', width = 4, height = 6, dpmm = 8 } = label;
    lastAudit = {
      url: `cache://${type.toLowerCase()}`,
      method: 'GET',
      headers: {},
      zplLength: zpl.length,
      dimensions: `${width}x${height} @ ${dpmm}dpmm`,
      durationMs: 0,
      cacheDurationMs: cacheTime,
      parseDurationMs: 0,
      status: 200,
      statusText: `OK (Cache ${type})`,
      timestamp: new Date().toISOString(),
      cacheHit: hit
    };
  },

  async processQueue() {
    if (isProcessing || queue.length === 0) return;
    isProcessing = true;

    const item = queue.shift()!;
    try {
      const blob = await this.executeRequestWithRetry(item.label);
      item.resolve(blob);
    } catch (error) {
      item.reject(error);
    } finally {
      // Rate limiter: aguarda 1 segundo antes da próxima
      setTimeout(() => {
        isProcessing = false;
        this.processQueue();
      }, RATE_LIMIT_MS);
    }
  },

  async executeRequestWithRetry(label: LabelData, attempt: number = 0): Promise<Blob> {
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
        parseDurationMs: 0,
        status: response.status,
        statusText: response.statusText,
        responseBody,
        timestamp: new Date().toISOString(),
        cacheHit: false,
        retries: attempt
      };

      if (!response.ok) {
        if (response.status === 429 && attempt < 3) {
          const backoff = Math.pow(2, attempt + 1) * 1000;
          console.warn(`[Labelary] Rate limit (429). Retrying in ${backoff}ms... (Attempt ${attempt + 1})`);
          await new Promise(r => setTimeout(r, backoff));
          return this.executeRequestWithRetry(label, attempt + 1);
        }
        throw new Error(`Labelary error ${response.status}: ${responseBody || 'Unknown error'}`);
      }

      const blob = await response.blob();
      const cacheKey = CryptoJS.SHA256(`${zpl}|${width}|${height}|${dpmm}`).toString();
      
      // Save to caches
      memoryCache.set(cacheKey, blob);
      const db = await getDB();
      if (db) {
        await db.put('previews', {
          hash: cacheKey,
          blob,
          timestamp: Date.now()
        });
        console.log(`[Labelary] Saved to IndexedDB: ${cacheKey}`);
      }

      return blob;
    } catch (error) {
      const duration = Date.now() - startTime;
      if (attempt < 3 && !(error instanceof Error && error.message.includes('429'))) {
         // Retry for network errors too
         console.warn(`[Labelary] Network error. Retrying... (Attempt ${attempt + 1})`);
         await new Promise(r => setTimeout(r, 1000));
         return this.executeRequestWithRetry(label, attempt + 1);
      }
      
      lastAudit = {
        url,
        method: 'POST',
        headers,
        zplLength: zpl.length,
        dimensions: `${width}x${height} @ ${dpmm}dpmm`,
        durationMs: duration,
        status: lastAudit?.status || 0,
        statusText: lastAudit?.statusText || 'Failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        cacheHit: false,
        retries: attempt
      };
      throw error;
    }
  }
};
