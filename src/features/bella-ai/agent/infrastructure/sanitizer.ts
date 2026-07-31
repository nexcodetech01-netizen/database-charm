/**
 * Audit Sanitizer — remove PII, credenciais e headers sensíveis de
 * qualquer objeto antes de gravar em `public.bella_executions` ou em
 * logs estruturados.
 *
 * Regra: chaves cujo nome bate com a blacklist são redigidas
 * (`"[REDACTED]"`). Strings suspeitas (JWT / API key patterns) também.
 * Profundidade limitada para evitar payloads patológicos.
 */

const REDACTED = "[REDACTED]";
const MAX_DEPTH = 8;
const MAX_STRING = 2000;

const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  /authorization/i,
  /^apikey$/i,
  /api[_-]?key/i,
  /secret/i,
  /token/i,
  /password/i,
  /passwd/i,
  /^pwd$/i,
  /session/i,
  /cookie/i,
  /^x-.*-key$/i,
  /service[_-]?role/i,
  /supabase[_-]?anon/i,
  /supabase[_-]?publishable/i,
  /jwt/i,
  /refresh[_-]?token/i,
  /access[_-]?token/i,
  /bearer/i,
  /^cpf$/i,
  /^cnpj$/i,
];

const SENSITIVE_STRING_PATTERNS: RegExp[] = [
  // JWT: xxx.yyy.zzz base64url
  /^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/,
  // Supabase sb_ opaque keys
  /^sb_(secret|publishable)_[A-Za-z0-9_-]{16,}$/,
  // Bearer tokens
  /^Bearer\s+/i,
];

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((rx) => rx.test(key));
}

function looksSensitiveString(value: string): boolean {
  return SENSITIVE_STRING_PATTERNS.some((rx) => rx.test(value));
}

export function sanitizeForAudit<T = unknown>(input: T): T {
  return walk(input, 0) as T;
}

function walk(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value;
  if (depth >= MAX_DEPTH) return REDACTED;

  const t = typeof value;
  if (t === "string") {
    const s = value as string;
    if (looksSensitiveString(s)) return REDACTED;
    return s.length > MAX_STRING ? `${s.slice(0, MAX_STRING)}…[truncated]` : s;
  }
  if (t === "number" || t === "boolean") return value;
  if (t === "bigint") return String(value);
  if (t === "function" || t === "symbol") return REDACTED;

  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => walk(item, depth + 1));
  }

  if (value instanceof Date) return value.toISOString();

  if (t === "object") {
    const out: Record<string, unknown> = {};
    const src = value as Record<string, unknown>;
    let count = 0;
    for (const key of Object.keys(src)) {
      if (count++ >= 100) {
        out.__truncated = true;
        break;
      }
      out[key] = isSensitiveKey(key) ? REDACTED : walk(src[key], depth + 1);
    }
    return out;
  }

  return REDACTED;
}

export const __REDACTED__ = REDACTED;
