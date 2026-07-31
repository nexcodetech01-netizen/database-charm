/**
 * Bella IA — Conversation Context layer
 *
 * Camada de memória conversacional de curta duração. Totalmente
 * desacoplada da UI, dos Providers e do parser de intents. Um LLM
 * pode consumir/atualizar este contexto no futuro sem alterar a
 * interface pública.
 *
 * NADA aqui é persistido — vive apenas em memória do processo e
 * expira por inatividade.
 */

import type { BellaModuleKey } from "../providers/modules/base";
import type { BellaActionResponse, BellaActionType } from "../actions/types";
import type { BellaSkillMissingField, BellaSkillPayload } from "../skills/types";

/**
 * Estado transitório de uma Skill em execução multi-etapa.
 *
 * - `skillId`             : Skill sendo coletada/executada.
 * - `payload`             : campos já coletados até agora.
 * - `awaitingField`       : próximo campo a ser respondido pelo usuário.
 * - `awaitingConfirmation`: se true, a próxima mensagem é sim/não.
 */
export interface BellaPendingSkill {
  skillId: string;
  payload: BellaSkillPayload;
  awaitingField?: BellaSkillMissingField;
  awaitingConfirmation?: boolean;
}

export interface BellaConversationContext {
  companyId: string;
  lastModule?: BellaModuleKey;
  lastAction?: BellaActionType;
  lastProvider?: BellaModuleKey;
  lastResponse?: BellaActionResponse;
  pendingSkill?: BellaPendingSkill | null;
  updatedAt: number;
}

export type BellaConversationPatch = Partial<
  Pick<
    BellaConversationContext,
    "lastModule" | "lastAction" | "lastProvider" | "lastResponse" | "pendingSkill"
  >
>;

/** TTL padrão — 5 min de inatividade. */
export const BELLA_CONTEXT_TTL_MS = 5 * 60 * 1000;
