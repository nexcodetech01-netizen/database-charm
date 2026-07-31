/**
 * Asaas API client helpers (server-only).
 * Only import from *.functions.ts handlers or server routes.
 *
 * P1-01 — Timeout: AbortSignal.timeout(15000) em toda chamada.
 * P1-02 — Retry exponencial (max 2) apenas para timeout / HTTP 5xx / network.
 *         Reintentar apenas métodos idempotentes (GET / DELETE) por padrão.
 *         POST/PUT só reintentam se `idempotent: true` for informado
 *         explicitamente pelo chamador (ex.: leitura de PIX QR).
 */

const ASAAS_URLS = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
} as const;

export type AsaasEnv = "sandbox" | "production";

export const ASAAS_TIMEOUT_MS = 15_000;
export const ASAAS_MAX_RETRIES = 2;

export function asaasBaseUrl(env: AsaasEnv): string {
  return ASAAS_URLS[env];
}

export interface AsaasFetchOptions {
  apiKey: string;
  environment: AsaasEnv;
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** Correlaciona logs de retry entre chamadas relacionadas. */
  correlationId?: string;
  /** Força tratamento idempotente para POST/PUT. */
  idempotent?: boolean;
  /** Timeout override (ms). Default: 15s. */
  timeoutMs?: number;
  /** Máximo de retries. Default: 2. */
  maxRetries?: number;
}

export interface AsaasAttemptLog {
  requestId: string;
  correlationId?: string;
  endpoint: string;
  method: string;
  attempt: number;
  durationMs: number;
  status?: number;
  reason: "ok" | "timeout" | "network" | "http_5xx" | "http_4xx";
  timeout: boolean;
}

function logAttempt(entry: AsaasAttemptLog): void {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      scope: "asaas-fetch",
      level: entry.reason === "ok" ? "info" : "warn",
      ...entry,
    }),
  );
}

function isIdempotentMethod(method: string, override?: boolean): boolean {
  if (override) return true;
  return method === "GET" || method === "DELETE";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function asaasFetch<T = unknown>(
  opts: AsaasFetchOptions,
): Promise<T> {
  const method = opts.method ?? "GET";
  const url = `${asaasBaseUrl(opts.environment)}${opts.path}`;
  const timeoutMs = opts.timeoutMs ?? ASAAS_TIMEOUT_MS;
  const maxRetries = Math.max(0, opts.maxRetries ?? ASAAS_MAX_RETRIES);
  const canRetry = isIdempotentMethod(method, opts.idempotent);
  const requestId = crypto.randomUUID();

  let lastErr: unknown;
  const totalAttempts = canRetry ? maxRetries + 1 : 1;

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    const startedAt = Date.now();
    let timedOut = false;

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          access_token: opts.apiKey,
          "User-Agent": "NexOS-BellaPay/1.0",
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });

      const durationMs = Date.now() - startedAt;
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      if (res.ok) {
        logAttempt({
          requestId,
          correlationId: opts.correlationId,
          endpoint: opts.path,
          method,
          attempt,
          durationMs,
          status: res.status,
          reason: "ok",
          timeout: false,
        });
        return data as T;
      }

      const is5xx = res.status >= 500 && res.status <= 599;
      logAttempt({
        requestId,
        correlationId: opts.correlationId,
        endpoint: opts.path,
        method,
        attempt,
        durationMs,
        status: res.status,
        reason: is5xx ? "http_5xx" : "http_4xx",
        timeout: false,
      });

      const message =
        data?.errors?.[0]?.description ||
        data?.message ||
        `Asaas request failed [${res.status}]`;
      const err = new Error(message);
      (err as Error & { status?: number; body?: unknown }).status = res.status;
      (err as Error & { body?: unknown }).body = data;

      // Retry apenas em 5xx e apenas se idempotente
      if (is5xx && canRetry && attempt < totalAttempts) {
        lastErr = err;
        await sleep(2 ** (attempt - 1) * 250);
        continue;
      }
      throw err;
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      timedOut =
        (err as Error)?.name === "TimeoutError" ||
        (err as Error)?.name === "AbortError";
      const isNetwork =
        !timedOut &&
        err instanceof TypeError; // fetch network failure

      // Já foi logado se veio de HTTP; loga aqui apenas exceções.
      if (timedOut || isNetwork) {
        logAttempt({
          requestId,
          correlationId: opts.correlationId,
          endpoint: opts.path,
          method,
          attempt,
          durationMs,
          reason: timedOut ? "timeout" : "network",
          timeout: timedOut,
        });

        if (canRetry && attempt < totalAttempts) {
          lastErr = err;
          await sleep(2 ** (attempt - 1) * 250);
          continue;
        }
      }
      throw err;
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error("Asaas request failed after retries");
}

export interface AsaasCustomer {
  id: string;
  name: string;
  cpfCnpj?: string;
  email?: string;
}

export interface AsaasCharge {
  id: string;
  customer: string;
  billingType: string;
  value: number;
  netValue?: number;
  dueDate: string;
  status: string;
  description?: string;
  externalReference?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  transactionReceiptUrl?: string;
}

export interface AsaasPixQr {
  encodedImage?: string;
  payload?: string;
  expirationDate?: string;
}
