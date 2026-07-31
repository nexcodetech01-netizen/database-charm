/**
 * Utilitários numéricos internos do Core Engine.
 * PRIVADO — não exportado no barrel público.
 */

/** Trata NaN/Infinity como não-finito. */
export function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Trunca ruído de ponto flutuante ao inteiro de centavos mais próximo. */
export function toCents(value: number): number {
  if (!isFiniteNumber(value)) return 0;
  // Math.round evita drift em multiplicações de percentuais.
  return Math.round(value);
}

/** Clamp inferior. */
export function atLeast(value: number, min: number): number {
  return value < min ? min : value;
}

/**
 * Hash determinístico (djb2 xor). Suficiente para `policyVersion` / `explainId`.
 * Não é criptográfico — não usar para segurança.
 */
export function stableHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  // Converte para hex sem sinal (32 bits).
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Serialização estável (chaves ordenadas) para hashing determinístico.
 * Evita variações de ordem entre versões do runtime.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k]))
      .join(",") +
    "}"
  );
}
