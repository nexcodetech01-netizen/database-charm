/**
 * P1-07 — Validação de valor recebido vs. valor da cobrança.
 * Tolerância ±0.01 (1 centavo).
 */
export const VALUE_TOLERANCE = 0.01;

export interface ValueCheckResult {
  ok: boolean;
  diff: number;
  expected: number;
  received: number;
}

export function checkPaymentValue(
  expected: number,
  received: number,
  tolerance: number = VALUE_TOLERANCE,
): ValueCheckResult {
  const diff = Math.abs(Number(expected) - Number(received));
  return {
    ok: diff <= tolerance + 1e-9,
    diff,
    expected: Number(expected),
    received: Number(received),
  };
}
