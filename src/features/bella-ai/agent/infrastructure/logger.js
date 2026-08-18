/**
 * Structured Logger para o Agente Operacional.
 * Emite JSON-line em produção; console formatado em DEV.
 * NUNCA loga o objeto bruto — sempre passa por `sanitizeForAudit`.
 */
import { sanitizeForAudit } from "./sanitizer";
const LEVEL_ORDER = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL = typeof import.meta !== "undefined" && import.meta.env?.DEV
    ? "debug"
    : "info";
function shouldEmit(level) {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[MIN_LEVEL];
}
function emit(level, message, fields = {}) {
    if (!shouldEmit(level))
        return;
    const safe = sanitizeForAudit(fields);
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
    debug: (m, f) => emit("debug", m, f),
    info: (m, f) => emit("info", m, f),
    warn: (m, f) => emit("warn", m, f),
    error: (m, f) => emit("error", m, f),
    child(base) {
        return {
            debug: (m, f) => emit("debug", m, { ...base, ...f }),
            info: (m, f) => emit("info", m, { ...base, ...f }),
            warn: (m, f) => emit("warn", m, { ...base, ...f }),
            error: (m, f) => emit("error", m, { ...base, ...f }),
        };
    },
};
