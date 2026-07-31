/**
 * Serialização versionada do domínio de configuração comercial
 * ============================================================
 * Envelope estável para persistência/transporte. NÃO acessa banco.
 * Falha rápido em versões incompatíveis (política N-1, ADR-008).
 */
import type { DomainIssue } from "./errors";
import { DomainValidationError } from "./errors";

export const CONFIG_DOMAIN_VERSION = "commercial-config/1.0.0" as const;

export type SupportedPayloadKind =
  | "CompanyPolicy"
  | "CategoryPolicy"
  | "ProductPolicy"
  | "PriceList"
  | "ChannelContract"
  | "TaxQuote"
  | "CostComposition";

export interface ConfigEnvelope<TKind extends SupportedPayloadKind, TPayload> {
  readonly envelopeVersion: typeof CONFIG_DOMAIN_VERSION;
  readonly kind: TKind;
  readonly payload: TPayload;
  readonly serializedAt: string;
}

export function toEnvelope<TKind extends SupportedPayloadKind, TPayload>(
  kind: TKind,
  payload: TPayload,
  now: string,
): ConfigEnvelope<TKind, TPayload> {
  return {
    envelopeVersion: CONFIG_DOMAIN_VERSION,
    kind,
    payload,
    serializedAt: now,
  };
}

export function toJSON<TKind extends SupportedPayloadKind, TPayload>(
  kind: TKind,
  payload: TPayload,
  now: string,
): string {
  return JSON.stringify(toEnvelope(kind, payload, now));
}

export interface ParseOptions {
  /** Kind esperado; se divergir, lança `DomainValidationError`. */
  expectKind?: SupportedPayloadKind;
}

export function fromJSON<TPayload>(
  raw: string,
  options: ParseOptions = {},
): ConfigEnvelope<SupportedPayloadKind, TPayload> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new DomainValidationError([
      {
        code: "MALFORMED_ENVELOPE",
        message: "JSON inválido",
        path: "envelope",
        severity: "error",
      },
    ]);
  }
  return fromEnvelope<TPayload>(parsed, options);
}

export function fromEnvelope<TPayload>(
  value: unknown,
  options: ParseOptions = {},
): ConfigEnvelope<SupportedPayloadKind, TPayload> {
  const issues: DomainIssue[] = [];
  if (value === null || typeof value !== "object") {
    issues.push({
      code: "MALFORMED_ENVELOPE",
      message: "envelope deve ser objeto",
      path: "envelope",
      severity: "error",
    });
    throw new DomainValidationError(issues);
  }
  const env = value as Record<string, unknown>;
  if (env.envelopeVersion !== CONFIG_DOMAIN_VERSION) {
    issues.push({
      code: "UNSUPPORTED_CONFIG_VERSION",
      message: `envelopeVersion não suportada`,
      path: "envelopeVersion",
      severity: "error",
      detail: { expected: CONFIG_DOMAIN_VERSION, actual: env.envelopeVersion },
    });
  }
  const validKinds: SupportedPayloadKind[] = [
    "CompanyPolicy",
    "CategoryPolicy",
    "ProductPolicy",
    "PriceList",
    "ChannelContract",
    "TaxQuote",
    "CostComposition",
  ];
  if (typeof env.kind !== "string" || !validKinds.includes(env.kind as SupportedPayloadKind)) {
    issues.push({
      code: "MALFORMED_ENVELOPE",
      message: `kind inválido`,
      path: "kind",
      severity: "error",
      detail: { expected: validKinds, actual: env.kind },
    });
  } else if (options.expectKind && env.kind !== options.expectKind) {
    issues.push({
      code: "MALFORMED_ENVELOPE",
      message: `kind divergente do esperado`,
      path: "kind",
      severity: "error",
      detail: { expected: options.expectKind, actual: env.kind },
    });
  }
  if (env.payload === undefined) {
    issues.push({
      code: "MALFORMED_ENVELOPE",
      message: "payload ausente",
      path: "payload",
      severity: "error",
    });
  }
  if (issues.length > 0) {
    throw new DomainValidationError(issues);
  }
  return env as unknown as ConfigEnvelope<SupportedPayloadKind, TPayload>;
}
