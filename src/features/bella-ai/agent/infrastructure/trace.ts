/**
 * Trace helpers — geração/propagação de requestId.
 */
export function newTraceId(prefix = "trc"): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return `${prefix}_${crypto.randomUUID()}`;
    }
  } catch {
    /* noop */
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
