/**
 * SessionMemory — store volátil in-memory.
 *
 * Contrato:
 *   - Chave: `sessionId` (opaco, gerado pelo caller).
 *   - Leitura scoped por `companyId`: se o contexto pertencer a outra
 *     empresa, `get` retorna `undefined` E apaga a entrada (defesa
 *     em profundidade contra troca de tenant sem `clearByCompany`).
 *   - Expiração aplicada em `get`; contextos expirados são apagados.
 *   - `remember(patch)` mescla shallow; `touch` atualiza `lastUsedAt`.
 *   - `markActionExecuted` / `markWorkflowExecuted` marcam
 *     `executed=true` — usado pelo guardrail para bloquear
 *     re-execução silenciosa via "aplica agora".
 *
 * NENHUM acesso a banco / Supabase / repositório / Application Layer.
 */
import {
  SESSION_CONTEXT_VERSION,
  type SessionContext,
  type SessionContextPatch,
} from "./contracts";
import {
  contextAgeMs,
  contextIdleMs,
  DEFAULT_EXPIRATION,
  isExpired,
  type ExpirationPolicy,
} from "./expiration";

export interface SessionMemoryClock {
  nowIso(): string;
}

export const systemSessionClock: SessionMemoryClock = {
  nowIso: () => new Date().toISOString(),
};

export interface SessionMemoryDeps {
  readonly clock?: SessionMemoryClock;
  readonly policy?: ExpirationPolicy;
}

export interface SessionScope {
  readonly sessionId: string;
  readonly companyId: string;
  readonly userId?: string;
}

export interface SessionMemory {
  get(scope: SessionScope): SessionContext | undefined;
  ensure(scope: SessionScope): SessionContext;
  remember(scope: SessionScope, patch: SessionContextPatch): SessionContext;
  markActionExecuted(scope: SessionScope, proposalId: string): void;
  markWorkflowExecuted(scope: SessionScope, proposalId: string): void;
  clear(sessionId: string): void;
  clearByCompany(companyId: string): number;
  clearByUser(userId: string): number;
  sweep(): number;
  ageMs(ctx: SessionContext): number;
  idleMs(ctx: SessionContext): number;
  /** Snapshot somente-leitura — testes/telemetria. */
  size(): number;
}

export function createSessionMemory(
  deps: SessionMemoryDeps = {},
): SessionMemory {
  const clock = deps.clock ?? systemSessionClock;
  const policy = deps.policy ?? DEFAULT_EXPIRATION;
  const store = new Map<string, SessionContext>();

  const isolate = (
    scope: SessionScope,
    ctx: SessionContext | undefined,
  ): SessionContext | undefined => {
    if (!ctx) return undefined;
    if (ctx.companyId !== scope.companyId) {
      // Multi-tenant leak defense: nunca devolver contexto de outra empresa.
      store.delete(ctx.sessionId);
      return undefined;
    }
    if (isExpired(ctx, clock.nowIso(), policy)) {
      store.delete(ctx.sessionId);
      return undefined;
    }
    return ctx;
  };

  return {
    get(scope) {
      return isolate(scope, store.get(scope.sessionId));
    },

    ensure(scope) {
      const existing = isolate(scope, store.get(scope.sessionId));
      if (existing) return existing;
      const now = clock.nowIso();
      const fresh: SessionContext = {
        version: SESSION_CONTEXT_VERSION,
        sessionId: scope.sessionId,
        companyId: scope.companyId,
        userId: scope.userId,
        createdAt: now,
        lastUsedAt: now,
      };
      store.set(scope.sessionId, fresh);
      return fresh;
    },

    remember(scope, patch) {
      const current =
        isolate(scope, store.get(scope.sessionId)) ??
        (() => {
          const now = clock.nowIso();
          const fresh: SessionContext = {
            version: SESSION_CONTEXT_VERSION,
            sessionId: scope.sessionId,
            companyId: scope.companyId,
            userId: scope.userId,
            createdAt: now,
            lastUsedAt: now,
          };
          return fresh;
        })();
      const next: SessionContext = {
        ...current,
        ...patch,
        lastUsedAt: clock.nowIso(),
      };
      store.set(scope.sessionId, next);
      return next;
    },

    markActionExecuted(scope, proposalId) {
      const ctx = isolate(scope, store.get(scope.sessionId));
      if (!ctx?.lastAction || ctx.lastAction.proposalId !== proposalId) return;
      store.set(scope.sessionId, {
        ...ctx,
        lastAction: { ...ctx.lastAction, executed: true },
        lastUsedAt: clock.nowIso(),
      });
    },

    markWorkflowExecuted(scope, proposalId) {
      const ctx = isolate(scope, store.get(scope.sessionId));
      if (!ctx?.lastWorkflow || ctx.lastWorkflow.proposalId !== proposalId)
        return;
      store.set(scope.sessionId, {
        ...ctx,
        lastWorkflow: { ...ctx.lastWorkflow, executed: true },
        lastUsedAt: clock.nowIso(),
      });
    },

    clear(sessionId) {
      store.delete(sessionId);
    },

    clearByCompany(companyId) {
      let n = 0;
      for (const [id, ctx] of store) {
        if (ctx.companyId === companyId) {
          store.delete(id);
          n++;
        }
      }
      return n;
    },

    clearByUser(userId) {
      let n = 0;
      for (const [id, ctx] of store) {
        if (ctx.userId === userId) {
          store.delete(id);
          n++;
        }
      }
      return n;
    },

    sweep() {
      const now = clock.nowIso();
      let n = 0;
      for (const [id, ctx] of store) {
        if (isExpired(ctx, now, policy)) {
          store.delete(id);
          n++;
        }
      }
      return n;
    },

    ageMs(ctx) {
      return contextAgeMs(ctx, clock.nowIso());
    },

    idleMs(ctx) {
      return contextIdleMs(ctx, clock.nowIso());
    },

    size() {
      return store.size;
    },
  };
}
