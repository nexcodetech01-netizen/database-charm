/**
 * EventRegistry
 *
 * Armazena, por tipo de evento, as reações declarativas que devem ser
 * disparadas quando o evento chega ao Dispatcher. Nenhuma reação
 * duplica regra de negócio — todas apontam para Workflow/Automação/Skill.
 */
import type { NexosEventReaction, NexosEventType } from "./types";

class EventRegistryImpl {
  private reactions = new Map<NexosEventType, NexosEventReaction[]>();
  private listeners = new Set<(type: NexosEventType) => void>();

  register(type: NexosEventType, reaction: NexosEventReaction): void {
    const list = this.reactions.get(type) ?? [];
    list.push(reaction);
    this.reactions.set(type, list);
    for (const l of this.listeners) l(type);
  }

  registerMany(entries: Array<{ type: NexosEventType; reaction: NexosEventReaction }>): void {
    for (const e of entries) this.register(e.type, e.reaction);
  }

  get(type: NexosEventType): NexosEventReaction[] {
    return this.reactions.get(type) ?? [];
  }

  listTypes(): NexosEventType[] {
    return Array.from(this.reactions.keys());
  }

  /** Somente testes. */
  __clearAll(): void {
    this.reactions.clear();
  }

  onChange(listener: (type: NexosEventType) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const EventRegistry = new EventRegistryImpl();
