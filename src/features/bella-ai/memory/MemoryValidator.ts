import type { BellaEntityRef, ConversationMemory, MemoryUpdatePatch } from "./MemoryTypes";

/**
 * Valida integridade mínima de uma memória / patch.
 * Não valida regras de negócio — apenas formato.
 */

export function isValidEntityRef(value: unknown): value is BellaEntityRef {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && v.id.length > 0 && typeof v.label === "string";
}

export function isValidMemory(memory: unknown): memory is ConversationMemory {
  if (!memory || typeof memory !== "object") return false;
  const m = memory as Record<string, unknown>;
  return (
    typeof m.tenantId === "string" &&
    typeof m.userId === "string" &&
    typeof m.createdAt === "number" &&
    typeof m.updatedAt === "number" &&
    typeof m.expiresAt === "number"
  );
}

export function sanitizePatch(patch: MemoryUpdatePatch): MemoryUpdatePatch {
  const clean: MemoryUpdatePatch = {};
  const entityKeys: Array<keyof MemoryUpdatePatch> = [
    "activeCustomer",
    "activeProduct",
    "activeQuote",
    "activeOrder",
  ];

  for (const key of Object.keys(patch) as Array<keyof MemoryUpdatePatch>) {
    const value = patch[key];
    if (value === undefined) continue;

    if (entityKeys.includes(key)) {
      if (value === null || isValidEntityRef(value)) {
        (clean as Record<string, unknown>)[key] = value;
      }
      continue;
    }

    if (key === "lastEntities" && Array.isArray(value)) {
      clean.lastEntities = value.filter(isValidEntityRef).slice(-10);
      continue;
    }

    (clean as Record<string, unknown>)[key] = value;
  }
  return clean;
}

/**
 * Detecta ambiguidade em um conjunto de candidatos que preencheriam
 * um mesmo slot (ex: dois clientes com nome "João").
 */
export function detectAmbiguity<T extends { id: string; label: string }>(
  candidates: T[],
): { ambiguous: boolean; candidates: T[] } {
  const unique = new Map<string, T>();
  for (const c of candidates) unique.set(c.id, c);
  const list = Array.from(unique.values());
  return { ambiguous: list.length > 1, candidates: list };
}
