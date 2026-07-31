/**
 * Feature flag do Agente Operacional Bella.
 *
 * Fonte de verdade (na ordem):
 *   1. localStorage `bella.agent.enabled` = "1"|"0"  (override manual / QA)
 *   2. VITE_BELLA_AGENT_ENABLED = "true"|"false"     (build)
 *   3. false (default seguro — mantém pipeline legado)
 *
 * NUNCA lança. Se algo falhar, retorna false → fluxo antigo continua.
 */

const STORAGE_KEY = "bella.agent.enabled";

export function isBellaAgentEnabled(): boolean {
  try {
    if (typeof window !== "undefined") {
      const override = window.localStorage.getItem(STORAGE_KEY);
      if (override === "1") return true;
      if (override === "0") return false;
    }
  } catch {
    // ignore
  }
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    const raw = env?.VITE_BELLA_AGENT_ENABLED;
    if (typeof raw === "string") {
      return raw.toLowerCase() === "true" || raw === "1";
    }
  } catch {
    // ignore
  }
  return false;
}

/** Override manual — apenas para debug/QA. */
export function setBellaAgentEnabled(value: boolean | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // ignore
  }
}
