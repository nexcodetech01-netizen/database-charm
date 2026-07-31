/**
 * Wrapper único de HTTP para integrações externas (server-only).
 *
 * Responsabilidades:
 *  - Timeout por tentativa (AbortController).
 *  - Retry com backoff exponencial + jitter.
 *  - Tratamento explícito de 429 (respeita `Retry-After`).
 *  - Tratamento de 5xx e erros de rede/timeout.
 *  - Nunca faz retry de métodos não idempotentes por padrão.
 *
 * Uso:
 *   const res = await integrationFetch("https://api.x/y", { headers }, {
 *     integration: "mercadolivre",
 *   });
 */

export interface IntegrationFetchOptions {
  /** Nome da integração, usado apenas em logs. */
  integration: string;
  /** Timeout por tentativa (ms). Padrão 15s. */
  timeoutMs?: number;
  /** Número máximo de tentativas (inclui a primeira). Padrão 3. */
  maxAttempts?: number;
  /** Backoff base em ms. Padrão 400ms. */
  baseDelayMs?: number;
  /** Teto do backoff em ms. Padrão 8s. */
  maxDelayMs?: number;
  /** Força retry mesmo em métodos não idempotentes (POST/PATCH). */
  retryNonIdempotent?: boolean;
}

const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "OPTIONS", "PUT", "DELETE"]);

export class IntegrationHttpError extends Error {
  readonly status: number | null;
  readonly integration: string;
  readonly attempts: number;
  readonly body: string | null;

  constructor(params: {
    message: string;
    status: number | null;
    integration: string;
    attempts: number;
    body?: string | null;
  }) {
    super(params.message);
    this.name = "IntegrationHttpError";
    this.status = params.status;
    this.integration = params.integration;
    this.attempts = params.attempts;
    this.body = params.body ?? null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Converte `Retry-After` (segundos ou HTTP-date) em ms. */
export function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const date = Date.parse(value);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

/** Backoff exponencial com jitter completo. */
export function computeBackoffDelay(
  attempt: number,
  baseDelayMs = 400,
  maxDelayMs = 8_000,
): number {
  const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
  return Math.round(exponential / 2 + Math.random() * (exponential / 2));
}

export function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export async function integrationFetch(
  input: string | URL,
  init: RequestInit = {},
  options: IntegrationFetchOptions,
): Promise<Response> {
  const {
    integration,
    timeoutMs = 15_000,
    maxAttempts = 3,
    baseDelayMs = 400,
    maxDelayMs = 8_000,
    retryNonIdempotent = false,
  } = options;

  const method = (init.method ?? "GET").toUpperCase();
  const canRetry = retryNonIdempotent || IDEMPOTENT_METHODS.has(method);
  const attempts = canRetry ? Math.max(1, maxAttempts) : 1;

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      clearTimeout(timer);

      if (response.ok || !shouldRetryStatus(response.status)) return response;

      if (attempt === attempts) return response;

      const retryAfter =
        response.status === 429 ? parseRetryAfter(response.headers.get("retry-after")) : null;
      const delay = retryAfter ?? computeBackoffDelay(attempt, baseDelayMs, maxDelayMs);
      console.warn(
        `[${integration}] HTTP ${response.status} — retry ${attempt}/${attempts - 1} em ${delay}ms`,
      );
      await sleep(Math.min(delay, maxDelayMs));
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      const isAbort = err instanceof Error && err.name === "AbortError";
      if (attempt === attempts) {
        throw new IntegrationHttpError({
          message: isAbort
            ? `[${integration}] timeout após ${timeoutMs}ms (${attempts} tentativa(s))`
            : `[${integration}] falha de rede: ${err instanceof Error ? err.message : String(err)}`,
          status: null,
          integration,
          attempts,
        });
      }
      const delay = computeBackoffDelay(attempt, baseDelayMs, maxDelayMs);
      console.warn(
        `[${integration}] ${isAbort ? "timeout" : "erro de rede"} — retry ${attempt}/${attempts - 1} em ${delay}ms`,
      );
      await sleep(delay);
    }
  }

  throw new IntegrationHttpError({
    message: `[${integration}] esgotadas as tentativas`,
    status: null,
    integration,
    attempts,
    body: lastError instanceof Error ? lastError.message : null,
  });
}

/** Helper: faz a chamada e devolve JSON, lançando IntegrationHttpError em não-2xx. */
export async function integrationFetchJson<T>(
  input: string | URL,
  init: RequestInit,
  options: IntegrationFetchOptions,
): Promise<T> {
  const response = await integrationFetch(input, init, options);
  const text = await response.text();
  if (!response.ok) {
    throw new IntegrationHttpError({
      message: `[${options.integration}] HTTP ${response.status}: ${text.slice(0, 300)}`,
      status: response.status,
      integration: options.integration,
      attempts: options.maxAttempts ?? 3,
      body: text,
    });
  }
  return JSON.parse(text) as T;
}
