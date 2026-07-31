export type WebhookAccessTokenValidationResult =
  | "valid"
  | "invalid"
  | "missing_header"
  | "secret_not_configured";

export interface WebhookAccessTokenValidation {
  secretFound: boolean;
  headerMasked: string;
  secretLength: number;
  headerLength: number;
  equalsAfterTrim: boolean;
  result: WebhookAccessTokenValidationResult;
  allowed: boolean;
}

const encoder = new TextEncoder();

/**
 * Remove somente whitespace externo, que pode ser introduzido ao copiar a
 * Secret ou durante o transporte HTTP. O conteúdo interno continua sendo
 * comparado byte a byte e com diferenciação de maiúsculas/minúsculas.
 */
function normalizeTransportValue(value: string): string {
  return value.trim();
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  let mismatch = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return mismatch === 0;
}

function maskHeader(value: string | null): string {
  if (value === null) return "absent";
  const byteLength = encoder.encode(normalizeTransportValue(value)).length;
  return `*** (${byteLength} bytes)`;
}

export function validateAsaasWebhookAccessToken(
  headers: Headers,
  configuredSecret: string | undefined,
): WebhookAccessTokenValidation {
  // Headers.get é case-insensitive; este é o nome canônico enviado pelo Asaas.
  const receivedHeader = headers.get("asaas-access-token");
  const rawExpected = configuredSecret ?? "";
  const rawReceived = receivedHeader ?? "";
  const expected = normalizeTransportValue(rawExpected);
  const received = normalizeTransportValue(rawReceived);
  const secretFound = expected.length > 0;
  const headerMasked = maskHeader(receivedHeader);
  const secretLength = rawExpected.length;
  const headerLength = rawReceived.length;
  const equalsAfterTrim = expected === received;

  if (!secretFound) {
    // Fail-closed: sem a Secret configurada não há como provar a origem do
    // webhook. Nunca liberar — o chamador deve responder 503.
    return {
      secretFound,
      headerMasked,
      secretLength,
      headerLength,
      equalsAfterTrim,
      result: "secret_not_configured",
      allowed: false,
    };
  }

  if (receivedHeader === null || received.length === 0) {
    return {
      secretFound,
      headerMasked,
      secretLength,
      headerLength,
      equalsAfterTrim,
      result: "missing_header",
      allowed: false,
    };
  }

  const allowed = constantTimeEqual(received, expected);
  return {
    secretFound,
    headerMasked,
    secretLength,
    headerLength,
    equalsAfterTrim,
    result: allowed ? "valid" : "invalid",
    allowed,
  };
}
