/**
 * Structured Logger para o Agente Operacional.
 * Emite JSON-line em produção; console formatado em DEV.
 * NUNCA loga o objeto bruto — sempre passa por `sanitizeForAudit`.
 */
import { sanitizeForAudit } from "./sanitizer";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  requestId?: string;
  companyId?: string;
  userId?: string | null;
  channel?: string;
  skillId?: string;
  intent?: string;
  durationMs?: number;
  [k: string]: unknown;
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL: LogLevel =
  typeof import.meta !== "undefined" && (import.meta as { env?: { DEV?: boolean } }).env?.DEV
    ? "debug"
    : "info";

function shouldEmit(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[MIN_LEVEL];
}

function emit(level: LogLevel, message: string, fields: LogFields = {}): void {
  if (!shouldEmit(level)) return;
  const safe = sanitizeForAudit(fields) as LogFields;
  const line = {
    ts: new Date().toISOString(),
    level,
    component: "bella-agent",
    message,
    ...safe,
  };
  const method = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  method(JSON.stringify(line));
}

export const logger = {
  debug: (m: string, f?: LogFields) => emit("debug", m, f),
  info: (m: string, f?: LogFields) => emit("info", m, f),
  warn: (m: string, f?: LogFields) => emit("warn", m, f),
  error: (m: string, f?: LogFields) => emit("error", m, f),
  child(base: LogFields) {
    return {
      debug: (m: string, f?: LogFields) => emit("debug", m, { ...base, ...f }),
      info: (m: string, f?: LogFields) => emit("info", m, { ...base, ...f }),
      warn: (m: string, f?: LogFields) => emit("warn", m, { ...base, ...f }),
      error: (m: string, f?: LogFields) => emit("error", m, { ...base, ...f }),
    };
  },
};

export type Logger = typeof logger;
