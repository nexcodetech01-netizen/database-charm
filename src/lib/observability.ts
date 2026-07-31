/**
 * Observability — logger estruturado + Correlation ID
 * =====================================================
 * Infraestrutura leve (não é um módulo/feature novo). Uso opcional em
 * Server Functions, Use Cases, Bella IA e Pricing Platform.
 *
 * DECISÕES:
 *   - Zero dependência externa. Roda no Worker (edge) e no browser.
 *   - JSON linha-a-linha (compatível com qualquer coletor).
 *   - `correlationId` propagado por chamada (não usa AsyncLocalStorage no
 *     Worker — passamos o id explícito como argumento do logger).
 *   - PII: mascara `token`, `password`, `secret`, `apiKey`, `authorization`
 *     em qualquer profundidade.
 *
 * COMO USAR:
 *   const log = createLogger({ module: "pricing", correlationId });
 *   log.info("resolve.start", { companyId, productId });
 *   try { ... } catch (err) { log.error("resolve.failed", { err }); throw err; }
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogRecord {
  readonly ts: string;
  readonly level: LogLevel;
  readonly module: string;
  readonly event: string;
  readonly correlationId?: string;
  readonly companyId?: string;
  readonly userId?: string;
  readonly durationMs?: number;
  readonly ok?: boolean;
  readonly error?: { name: string; message: string; stack?: string };
  readonly ctx?: Record<string, unknown>;
}

export interface LoggerContext {
  readonly module: string;
  readonly correlationId?: string;
  readonly companyId?: string;
  readonly userId?: string;
}

export interface Logger {
  child(overrides: Partial<LoggerContext>): Logger;
  debug(event: string, ctx?: Record<string, unknown>): void;
  info(event: string, ctx?: Record<string, unknown>): void;
  warn(event: string, ctx?: Record<string, unknown>): void;
  error(event: string, ctx?: Record<string, unknown>): void;
  /**
   * Envelope de execução — grava start, end + duração e re-lança em caso de erro.
   * Uso: `await log.span("compute", { productId }, async () => engine.compute(ctx))`.
   */
  span<T>(
    event: string,
    ctx: Record<string, unknown> | undefined,
    fn: () => Promise<T> | T,
  ): Promise<T>;
}

const SENSITIVE_KEYS = new Set([
  "token",
  "access_token",
  "refresh_token",
  "authorization",
  "password",
  "secret",
  "apikey",
  "api_key",
  "cookie",
  "set-cookie",
]);

export function maskDeep(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value;
  if (typeof value === "string") return value.length > 4096 ? value.slice(0, 4096) + "…" : value;
  if (Array.isArray(value)) return value.map((v) => maskDeep(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? "[REDACTED]" : maskDeep(v, depth + 1);
    }
    return out;
  }
  return value;
}

function serializeError(err: unknown): LogRecord["error"] {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { name: "NonError", message: String(err) };
}

function emit(record: LogRecord): void {
  const line = JSON.stringify(record);
  switch (record.level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "debug":
      console.debug(line);
      break;
    default:
      console.log(line);
  }
}

export function createLogger(ctx: LoggerContext): Logger {
  const base = ctx;
  const write = (level: LogLevel, event: string, extra?: Record<string, unknown>) => {
    emit({
      ts: new Date().toISOString(),
      level,
      module: base.module,
      event,
      correlationId: base.correlationId,
      companyId: base.companyId,
      userId: base.userId,
      ctx: extra ? (maskDeep(extra) as Record<string, unknown>) : undefined,
    });
  };

  return {
    child(overrides) {
      return createLogger({ ...base, ...overrides });
    },
    debug: (event, extra) => write("debug", event, extra),
    info: (event, extra) => write("info", event, extra),
    warn: (event, extra) => write("warn", event, extra),
    error: (event, extra) => write("error", event, extra),
    async span(event, extra, fn) {
      const startedAt = Date.now();
      write("info", event, extra ? { ...extra, phase: "start" } : { phase: "start" });
      try {
        const result = await fn();
        emit({
          ts: new Date().toISOString(),
          level: "info",
          module: base.module,
          event,
          correlationId: base.correlationId,
          companyId: base.companyId,
          userId: base.userId,
          ok: true,
          durationMs: Date.now() - startedAt,
          ctx: extra ? (maskDeep({ ...extra, phase: "end" }) as Record<string, unknown>) : undefined,
        });
        return result;
      } catch (err) {
        emit({
          ts: new Date().toISOString(),
          level: "error",
          module: base.module,
          event,
          correlationId: base.correlationId,
          companyId: base.companyId,
          userId: base.userId,
          ok: false,
          durationMs: Date.now() - startedAt,
          error: serializeError(err),
          ctx: extra ? (maskDeep({ ...extra, phase: "error" }) as Record<string, unknown>) : undefined,
        });
        throw err;
      }
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Correlation ID
// ─────────────────────────────────────────────────────────────────────────────

const CORRELATION_HEADER = "x-nexos-correlation-id" as const;

/**
 * Extrai correlation-id do header do Request; gera um novo se ausente.
 * Formato: `nxs-<timestamp base36>-<random>`. Opaco, seguro para log.
 */
export function readOrCreateCorrelationId(request?: Request): string {
  const incoming = request?.headers.get(CORRELATION_HEADER)?.trim();
  if (incoming && /^[\w-]{6,128}$/.test(incoming)) return incoming;
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `nxs-${Date.now().toString(36)}-${rand}`;
}

export const CORRELATION_HEADER_NAME = CORRELATION_HEADER;
