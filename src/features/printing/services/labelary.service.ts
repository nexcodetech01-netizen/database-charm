import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { LabelData, LabelaryAudit } from "../types/printing.types";

/**
 * Serviço para a API do Labelary (https://labelary.com): converte ZPL em
 * PDF/PNG com cache em memória (LRU) + IndexedDB, fila com rate limit de
 * 1 req/s e deduplicação de pedidos simultâneos da mesma etiqueta.
 */

type LabelFormat = "pdf" | "png";

interface LabelCacheDB extends DBSchema {
  previews: {
    key: string;
    value: { hash: string; blob: Blob; timestamp: number };
    indexes: { by_timestamp: number };
  };
}

const RATE_LIMIT_MS = 1_000;
const MAX_RETRIES = 3;
const MEMORY_CACHE_MAX = 30; // etiquetas mantidas em RAM (LRU)
const IDB_CACHE_MAX = 300; // teto do cache persistente

const debug = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log("[Labelary]", ...args);
};
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

class LabelaryHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Labelary error ${status}: ${body || "Unknown error"}`);
  }
}

/** Só re-tenta falha de rede, 429 e 5xx. Erro 4xx (ZPL inválido) falha na hora. */
const isRetryable = (err: unknown) =>
  !(err instanceof LabelaryHttpError) || err.status === 429 || err.status >= 500;

/* ---------- Estado do módulo ---------- */

let lastAudit: LabelaryAudit | null = null;
const memoryCache = new Map<string, Blob>();
const inFlight = new Map<string, Promise<Blob>>();
let dbPromise: Promise<IDBPDatabase<LabelCacheDB>> | null = null;
let queueTail: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

/* ---------- Helpers ---------- */

function normalize(label: LabelData) {
  const { zpl = "", width = 4, height = 6, dpmm = 8 } = label;
  return { zpl, width, height, dpmm };
}

/** SHA-256 em hex — mesmo formato do crypto-js, então o cache antigo continua válido. */
async function hashKey(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function memoryGet(key: string) {
  const blob = memoryCache.get(key);
  if (blob) {
    memoryCache.delete(key); // move para o fim = mais recente
    memoryCache.set(key, blob);
  }
  return blob;
}

function memorySet(key: string, blob: Blob) {
  memoryCache.set(key, blob);
  if (memoryCache.size > MEMORY_CACHE_MAX) {
    memoryCache.delete(memoryCache.keys().next().value as string);
  }
}

function getDB() {
  if (typeof window === "undefined") return null;
  dbPromise ??= openDB<LabelCacheDB>("nexos-labelary-cache", 2, {
    upgrade(db, oldVersion, _newVersion, tx) {
      const store =
        oldVersion < 1
          ? db.createObjectStore("previews", { keyPath: "hash" })
          : tx.objectStore("previews");
      if (oldVersion < 2) store.createIndex("by_timestamp", "timestamp");
    },
  });
  return dbPromise;
}

async function pruneDB(db: IDBPDatabase<LabelCacheDB>) {
  const tx = db.transaction("previews", "readwrite");
  let excess = (await tx.store.count()) - IDB_CACHE_MAX;
  let cursor = excess > 0 ? await tx.store.index("by_timestamp").openCursor() : null;
  while (cursor && excess-- > 0) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

/** Fila serial com 1 requisição por segundo. */
function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = queueTail.then(async () => {
    const wait = lastRequestAt + RATE_LIMIT_MS - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      return await task();
    } finally {
      lastRequestAt = Date.now();
    }
  });
  queueTail = run.catch(() => undefined);
  return run;
}

function recordCacheHit(label: LabelData, type: "Memory" | "IndexedDB", cacheTime = 0) {
  const { zpl, width, height, dpmm } = normalize(label);
  debug(`cache hit (${type})`);
  lastAudit = {
    url: `cache://${type.toLowerCase()}`,
    method: "GET",
    headers: {},
    zplLength: zpl.length,
    dimensions: `${width}x${height} @ ${dpmm}dpmm`,
    durationMs: 0,
    cacheDurationMs: cacheTime,
    parseDurationMs: 0,
    status: 200,
    statusText: `OK (Cache ${type})`,
    timestamp: new Date().toISOString(),
    cacheHit: true,
  };
}

async function fetchWithRetry(label: LabelData, format: LabelFormat): Promise<Blob> {
  const { zpl, width, height, dpmm } = normalize(label);
  const url = `https://api.labelary.com/v1/printers/${dpmm}dpmm/labels/${width}x${height}/0/`;
  const headers = {
    Accept: format === "pdf" ? "application/pdf" : "image/png",
    "Content-Type": "application/x-www-form-urlencoded",
  };
  const base = {
    url,
    method: "POST",
    headers,
    zplLength: zpl.length,
    dimensions: `${width}x${height} @ ${dpmm}dpmm`,
  };

  for (let attempt = 0; ; attempt++) {
    const startedAt = Date.now();
    try {
      const response = await fetch(url, { method: "POST", headers, body: zpl });
      const responseBody = response.ok ? "" : await response.text();
      lastAudit = {
        ...base,
        durationMs: Date.now() - startedAt,
        parseDurationMs: 0,
        status: response.status,
        statusText: response.statusText,
        responseBody,
        timestamp: new Date().toISOString(),
        cacheHit: false,
        retries: attempt,
      };
      if (!response.ok) throw new LabelaryHttpError(response.status, responseBody);
      return await response.blob();
    } catch (error) {
      if (attempt < MAX_RETRIES && isRetryable(error)) {
        const is429 = error instanceof LabelaryHttpError && error.status === 429;
        const backoff = is429 ? 2 ** (attempt + 1) * 1_000 : 1_000;
        console.warn(
          `[Labelary] ${is429 ? "Rate limit" : "Falha"} — nova tentativa em ${backoff}ms (${attempt + 1}/${MAX_RETRIES})`,
        );
        await sleep(backoff);
        continue;
      }
      lastAudit = {
        ...base,
        durationMs: Date.now() - startedAt,
        status: lastAudit?.status ?? 0,
        statusText: lastAudit?.statusText ?? "Failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        cacheHit: false,
        retries: attempt,
      };
      throw error;
    }
  }
}

async function resolveLabel(label: LabelData, format: LabelFormat): Promise<Blob> {
  const { zpl, width, height, dpmm } = normalize(label);
  const key = await hashKey(`${zpl}|${width}|${height}|${dpmm}|${format}`);

  const inMemory = memoryGet(key);
  if (inMemory) {
    recordCacheHit(label, "Memory");
    return inMemory;
  }

  const pending = inFlight.get(key);
  if (pending) return pending;

  const job = (async () => {
    const db = await getDB();
    if (db) {
      const t0 = performance.now();
      const cached = await db.get("previews", key);
      if (cached) {
        memorySet(key, cached.blob);
        recordCacheHit(label, "IndexedDB", performance.now() - t0);
        return cached.blob;
      }
    }

    const blob = await schedule(() => fetchWithRetry(label, format));
    memorySet(key, blob);

    if (db) {
      // Falha de quota no IndexedDB não pode derrubar a impressão.
      await db
        .put("previews", { hash: key, blob, timestamp: Date.now() })
        .then(() => pruneDB(db))
        .catch((err) => console.warn("[Labelary] Falha ao gravar cache:", err));
    }
    return blob;
  })().finally(() => inFlight.delete(key));

  inFlight.set(key, job);
  return job;
}

export const labelaryService = {
  getLastAudit: (): LabelaryAudit | null => lastAudit,
  convertToFormat: (label: LabelData, format: LabelFormat = "pdf") => resolveLabel(label, format),
  convertToPdf: (label: LabelData) => resolveLabel(label, "pdf"),
  convertToPng: (label: LabelData) => resolveLabel(label, "png"),
};
