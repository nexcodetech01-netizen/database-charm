import {
  DEFAULT_TTL_MS,
  applyPatch,
  clearMemory,
  createMemory,
  isExpired,
  touch,
} from "./BellaMemory";
import type {
  ConversationMemory,
  MemoryKey,
  MemoryLogEntry,
  MemoryLogEvent,
  MemoryUpdatePatch,
} from "./MemoryTypes";
import { summarize } from "./MemorySerializer";

const RESET_PHRASES = [
  "cancelar",
  "cancela",
  "limpar conversa",
  "limpa conversa",
  "começar novamente",
  "comecar novamente",
  "começar de novo",
  "recomeçar",
  "recomecar",
  "esqueça",
  "esquece",
  "reset",
];

/**
 * BellaMemoryManager — gerencia memórias em processo, isoladas por tenant+user.
 * In-memory apenas (Map). Não persiste. Não usa storage. Não substitui context/manager.ts.
 *
 * Uso: consultar via `resolve()` antes de chamar o AI Gateway; após a Skill
 * executar, chamar `updateFromSkillResult()` para propagar entidades ativas.
 */
export class BellaMemoryManager {
  private store = new Map<MemoryKey, ConversationMemory>();
  private logs: MemoryLogEntry[] = [];
  private ttlMs: number;
  private maxLogs = 200;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  private key(tenantId: string, userId: string): MemoryKey {
    return `${tenantId}::${userId}` as MemoryKey;
  }

  private log(event: MemoryLogEvent, key: MemoryKey, detail?: string): void {
    this.logs.push({ event, key, at: Date.now(), detail });
    if (this.logs.length > this.maxLogs) this.logs.splice(0, this.logs.length - this.maxLogs);
  }

  /** Retorna a memória atual ou cria uma nova; descarta se expirada. */
  get(tenantId: string, userId: string): ConversationMemory {
    const k = this.key(tenantId, userId);
    const existing = this.store.get(k);
    if (existing) {
      if (isExpired(existing)) {
        this.store.delete(k);
        this.log("expired", k, summarize(existing));
      } else {
        return existing;
      }
    }
    const fresh = createMemory(tenantId, userId, this.ttlMs);
    this.store.set(k, fresh);
    this.log("created", k);
    return fresh;
  }

  /** Retorna a memória sem criar (útil para leitura pura). */
  peek(tenantId: string, userId: string): ConversationMemory | null {
    const k = this.key(tenantId, userId);
    const existing = this.store.get(k);
    if (!existing) return null;
    if (isExpired(existing)) {
      this.store.delete(k);
      this.log("expired", k, summarize(existing));
      return null;
    }
    return existing;
  }

  update(tenantId: string, userId: string, patch: MemoryUpdatePatch): ConversationMemory {
    const memory = this.get(tenantId, userId);
    applyPatch(memory, patch, this.ttlMs);
    this.log("updated", this.key(tenantId, userId), summarize(memory));
    return memory;
  }

  /** Estende TTL sem alterar campos (heartbeat de atividade). */
  touch(tenantId: string, userId: string): void {
    const memory = this.peek(tenantId, userId);
    if (memory) touch(memory, this.ttlMs);
  }

  /** Reset explícito: limpa entidades ativas mas mantém a memória viva. */
  reset(tenantId: string, userId: string, reason: string = "manual"): void {
    const memory = this.peek(tenantId, userId);
    if (!memory) return;
    clearMemory(memory);
    touch(memory, this.ttlMs);
    this.log("reset", this.key(tenantId, userId), reason);
  }

  /** Descarta completamente a memória. */
  discard(tenantId: string, userId: string, reason: string = "manual"): void {
    const k = this.key(tenantId, userId);
    if (this.store.delete(k)) this.log("discarded", k, reason);
  }

  /** Detecta comandos explícitos de reset em uma mensagem do usuário. */
  isResetCommand(message: string): boolean {
    const norm = message.trim().toLowerCase();
    if (!norm) return false;
    return RESET_PHRASES.some((p) => norm === p || norm.startsWith(`${p} `) || norm.endsWith(` ${p}`));
  }

  /** Faz sweep de memórias expiradas (útil para chamar periodicamente). */
  sweep(): number {
    let removed = 0;
    const now = Date.now();
    for (const [k, mem] of this.store) {
      if (isExpired(mem, now)) {
        this.store.delete(k);
        this.log("expired", k, summarize(mem));
        removed++;
      }
    }
    return removed;
  }

  getLogs(): readonly MemoryLogEntry[] {
    return this.logs;
  }

  /** Somente para testes. */
  __clearAll(): void {
    this.store.clear();
    this.logs = [];
  }
}

/** Singleton compartilhado. */
export const bellaMemoryManager = new BellaMemoryManager();
