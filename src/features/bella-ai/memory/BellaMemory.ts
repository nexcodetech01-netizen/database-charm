import type {
  BellaEntityRef,
  ConversationMemory,
  MemoryUpdatePatch,
} from "./MemoryTypes";
import { sanitizePatch } from "./MemoryValidator";

/**
 * BellaMemory — representação viva de uma memória conversacional.
 * Objeto mutável leve; toda mutação atualiza updatedAt e estende expiresAt.
 */

export const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutos de inatividade

export function createMemory(
  tenantId: string,
  userId: string,
  ttlMs: number = DEFAULT_TTL_MS,
): ConversationMemory {
  const now = Date.now();
  return {
    tenantId,
    userId,
    currentGoal: null,
    activeSkill: null,
    activeModule: null,
    activeCustomer: null,
    activeProduct: null,
    activeQuote: null,
    activeOrder: null,
    activeConversationState: "idle",
    collectedParameters: {},
    pendingFields: [],
    lastEntities: [],
    lastAction: null,
    lastResponse: null,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + ttlMs,
  };
}

export function isExpired(memory: ConversationMemory, now: number = Date.now()): boolean {
  return memory.expiresAt <= now;
}

export function touch(memory: ConversationMemory, ttlMs: number = DEFAULT_TTL_MS): void {
  const now = Date.now();
  memory.updatedAt = now;
  memory.expiresAt = now + ttlMs;
}

export function applyPatch(
  memory: ConversationMemory,
  patch: MemoryUpdatePatch,
  ttlMs: number = DEFAULT_TTL_MS,
): ConversationMemory {
  const clean = sanitizePatch(patch);
  Object.assign(memory, clean);

  // Rastreia entidades ativas em lastEntities automaticamente
  const activeRefs: BellaEntityRef[] = [
    memory.activeCustomer,
    memory.activeProduct,
    memory.activeQuote,
    memory.activeOrder,
  ].filter((e): e is BellaEntityRef => e !== null);

  if (activeRefs.length > 0) {
    const merged = [...memory.lastEntities, ...activeRefs];
    const dedup = new Map<string, BellaEntityRef>();
    for (const ref of merged) dedup.set(ref.id, ref);
    memory.lastEntities = Array.from(dedup.values()).slice(-10);
  }

  touch(memory, ttlMs);
  return memory;
}

export function clearMemory(memory: ConversationMemory): void {
  memory.currentGoal = null;
  memory.activeSkill = null;
  memory.activeCustomer = null;
  memory.activeProduct = null;
  memory.activeQuote = null;
  memory.activeOrder = null;
  memory.activeConversationState = "idle";
  memory.collectedParameters = {};
  memory.pendingFields = [];
  memory.lastAction = null;
  memory.lastResponse = null;
  memory.updatedAt = Date.now();
}
