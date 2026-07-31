/**
 * Rate limiter server-only — janela deslizante em memória.
 *
 * Nota operacional: no runtime Cloudflare Workers cada isolate tem seu
 * próprio Map. Isso não é um limitador distribuído perfeito — é a primeira
 * linha de defesa contra scraping/replay trivial em rotas /api/public/*.
 * Uma solução distribuída (KV/Durable Objects) fica no roadmap.
 */
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

type Bucket = { timestamps: number[] };
const BUCKETS = new Map<string, Bucket>();
const MAX_KEYS = 5000;

export interface RateLimitOptions {
  /** Identificador estável da rota (ex.: "catalog:collection"). */
  readonly route: string;
  /** Janela em ms. Default: 60_000. */
  readonly windowMs?: number;
  /** Máx. requisições por IP dentro da janela. Default: 60. */
  readonly max?: number;
}

export interface RateLimitResult {
  readonly ok: boolean;
  readonly remaining: number;
  readonly retryAfterSec: number;
  readonly ip: string;
}

function resolveIp(): string {
  try {
    const ip = getRequestIP({ xForwardedFor: true });
    if (ip) return ip;
  } catch {
    /* fallthrough */
  }
  try {
    const cf = getRequestHeader("cf-connecting-ip");
    if (cf) return cf;
    const xff = getRequestHeader("x-forwarded-for");
    if (xff) return xff.split(",")[0]!.trim();
  } catch {
    /* noop */
  }
  return "unknown";
}

function prune(bucket: Bucket, cutoff: number): void {
  let i = 0;
  while (i < bucket.timestamps.length && bucket.timestamps[i]! < cutoff) i++;
  if (i > 0) bucket.timestamps.splice(0, i);
}

/**
 * Aplica rate limit. Retorna `{ ok: true }` se dentro do limite,
 * ou `{ ok: false, retryAfterSec }` para o chamador emitir 429.
 */
export function checkRateLimit(opts: RateLimitOptions): RateLimitResult {
  const windowMs = opts.windowMs ?? 60_000;
  const max = opts.max ?? 60;
  const ip = resolveIp();
  const key = `${opts.route}:${ip}`;
  const now = Date.now();
  const cutoff = now - windowMs;

  let bucket = BUCKETS.get(key);
  if (!bucket) {
    // GC oportunista para evitar leak em long-running isolates
    if (BUCKETS.size > MAX_KEYS) {
      for (const [k, b] of BUCKETS) {
        if (b.timestamps.length === 0 || b.timestamps[b.timestamps.length - 1]! < cutoff) {
          BUCKETS.delete(k);
        }
        if (BUCKETS.size <= MAX_KEYS / 2) break;
      }
    }
    bucket = { timestamps: [] };
    BUCKETS.set(key, bucket);
  }

  prune(bucket, cutoff);

  if (bucket.timestamps.length >= max) {
    const oldest = bucket.timestamps[0]!;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return { ok: false, remaining: 0, retryAfterSec, ip };
  }

  bucket.timestamps.push(now);
  return {
    ok: true,
    remaining: max - bucket.timestamps.length,
    retryAfterSec: 0,
    ip,
  };
}

/**
 * Emite Response 429 padronizado. Loga no formato estruturado esperado
 * pelo pipeline de observabilidade (`server-function-logs`).
 */
export function rateLimitResponse(
  result: RateLimitResult,
  opts: RateLimitOptions,
  extraHeaders: Record<string, string> = {},
): Response {
  console.warn(
    `[rate-limit] blocked route=${opts.route} ip=${result.ip} retryAfter=${result.retryAfterSec}s`,
  );
  return new Response(
    JSON.stringify({ error: "rate_limited", retry_after: result.retryAfterSec }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "Retry-After": String(result.retryAfterSec),
        "X-RateLimit-Remaining": "0",
        ...extraHeaders,
      },
    },
  );
}

/** Helper único: verifica e retorna Response 429 pronto, ou null. */
export function enforceRateLimit(
  opts: RateLimitOptions,
  extraHeaders: Record<string, string> = {},
): Response | null {
  const result = checkRateLimit(opts);
  if (!result.ok) return rateLimitResponse(result, opts, extraHeaders);
  return null;
}
