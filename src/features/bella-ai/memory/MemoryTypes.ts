/**
 * Bella Memory - Types
 *
 * Camada de memória de curto prazo (contexto conversacional).
 * NÃO substitui context/manager.ts existente — é uma camada adicional
 * desacoplada, opt-in, focada em entidades ativas e continuidade de fala.
 *
 * NÃO usar para: persistência, embeddings, RAG, aprendizado.
 */

export type BellaEntityRef = {
  id: string;
  label: string;
  /** Payload livre para dados leves da entidade (nome, doc, valor). Nunca dados sensíveis. */
  data?: Record<string, unknown>;
};

export type ConversationState =
  | "idle"
  | "collecting_parameters"
  | "awaiting_confirmation"
  | "executing"
  | "completed"
  | "cancelled";

export interface ConversationMemory {
  tenantId: string;
  userId: string;

  currentGoal: string | null;
  activeSkill: string | null;
  activeModule: string | null;

  activeCustomer: BellaEntityRef | null;
  activeProduct: BellaEntityRef | null;
  activeQuote: BellaEntityRef | null;
  activeOrder: BellaEntityRef | null;

  activeConversationState: ConversationState;

  collectedParameters: Record<string, unknown>;
  pendingFields: string[];

  lastEntities: BellaEntityRef[];
  lastAction: string | null;
  lastResponse: string | null;

  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

export type MemoryKey = `${string}::${string}`; // tenantId::userId

export interface MemoryUpdatePatch {
  currentGoal?: string | null;
  activeSkill?: string | null;
  activeModule?: string | null;
  activeCustomer?: BellaEntityRef | null;
  activeProduct?: BellaEntityRef | null;
  activeQuote?: BellaEntityRef | null;
  activeOrder?: BellaEntityRef | null;
  activeConversationState?: ConversationState;
  collectedParameters?: Record<string, unknown>;
  pendingFields?: string[];
  lastEntities?: BellaEntityRef[];
  lastAction?: string | null;
  lastResponse?: string | null;
}

export type MemoryLogEvent =
  | "created"
  | "updated"
  | "expired"
  | "discarded"
  | "reset";

export interface MemoryLogEntry {
  event: MemoryLogEvent;
  key: MemoryKey;
  at: number;
  detail?: string;
}
