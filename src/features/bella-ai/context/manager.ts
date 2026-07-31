/**
 * BellaConversationManager
 *
 * Store in-memory, scoped por `companyId`. Sem Supabase, sem hooks,
 * sem dependências de UI. Expira contextos ociosos automaticamente.
 */
import {
  BELLA_CONTEXT_TTL_MS,
  type BellaConversationContext,
  type BellaConversationPatch,
} from "./types";

export interface BellaConversationClock {
  now(): number;
}

const systemClock: BellaConversationClock = { now: () => Date.now() };

export interface BellaConversationManagerDeps {
  readonly clock?: BellaConversationClock;
  readonly ttlMs?: number;
}

export interface BellaConversationManager {
  get(companyId: string): BellaConversationContext | undefined;
  update(
    companyId: string,
    patch: BellaConversationPatch,
  ): BellaConversationContext;
  clear(companyId: string): void;
  sweep(): number;
  /** Snapshot somente-leitura — testes/telemetria. */
  size(): number;
}

export function createBellaConversationManager(
  deps: BellaConversationManagerDeps = {},
): BellaConversationManager {
  const clock = deps.clock ?? systemClock;
  const ttl = deps.ttlMs ?? BELLA_CONTEXT_TTL_MS;
  const store = new Map<string, BellaConversationContext>();

  const isExpired = (ctx: BellaConversationContext, now: number) =>
    now - ctx.updatedAt > ttl;

  const read = (companyId: string): BellaConversationContext | undefined => {
    const ctx = store.get(companyId);
    if (!ctx) return undefined;
    if (isExpired(ctx, clock.now())) {
      store.delete(companyId);
      return undefined;
    }
    return ctx;
  };

  return {
    get(companyId) {
      return read(companyId);
    },
    update(companyId, patch) {
      const current = read(companyId);
      const next: BellaConversationContext = {
        companyId,
        ...(current ?? {}),
        ...patch,
        updatedAt: clock.now(),
      };
      store.set(companyId, next);
      return next;
    },
    clear(companyId) {
      store.delete(companyId);
    },
    sweep() {
      const now = clock.now();
      let n = 0;
      for (const [id, ctx] of store) {
        if (isExpired(ctx, now)) {
          store.delete(id);
          n++;
        }
      }
      return n;
    },
    size() {
      return store.size;
    },
  };
}

/** Singleton padrão usado pelo BellaActionEngine. */
export const bellaConversationManager = createBellaConversationManager();
