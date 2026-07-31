/**
 * Bella IA — Skills layer (execução de tarefas)
 *
 * Contratos da camada que executa operações reais nos módulos do NexOS.
 * Cada Skill consome exclusivamente Services já existentes — nenhuma
 * regra de negócio é duplicada. Totalmente desacoplada da UI e sem IA:
 * o parser identifica a Skill por palavras-chave e o Registry dispara
 * a execução com o payload informado.
 *
 * Fluxo:
 *   Mensagem → ActionEngine → SkillRegistry → Skill → Service → Banco
 *   → BellaSkillResult → BellaActionResponse
 */

import type { BellaModuleKey } from "../providers/modules/base";

/** Contexto mínimo passado a toda Skill. */
export interface BellaSkillContext {
  companyId: string;
  userId?: string | null;
}

/** Payload livre — a Skill valida os campos que precisa. */
export type BellaSkillPayload = Record<string, unknown>;

export interface BellaSkillMissingField {
  field: string;
  label: string;
  type: "text" | "number" | "money" | "date" | "datetime" | "uuid" | "enum";
  required: true;
  options?: string[];
  hint?: string;
}

/** Códigos de resultado padronizados — nunca strings livres. */
export type BellaSkillResultCode =
  | "success"
  | "missing_fields"
  | "invalid_payload"
  | "module_unavailable"
  | "not_allowed"
  | "error";

export interface BellaSkillSuggestion {
  id: string;
  title: string;
  actionLabel?: string;
}

export interface BellaSkillResult<TData = unknown> {
  /** true apenas quando code === "success". */
  ok: boolean;
  code: BellaSkillResultCode;
  /** Mensagem curta pronta para exibição. */
  message: string;
  /** Dados retornados pelo Service (id criado, registro atualizado, etc). */
  data?: TData;
  /** Campos ainda pendentes quando code === "missing_fields". */
  missingFields?: BellaSkillMissingField[];
  /** Próximas ações sugeridas (mesma semântica de BellaActionSuggestion). */
  suggestions?: BellaSkillSuggestion[];
}

/**
 * Interface padrão de execução de tarefas da Bella.
 *
 * - `canExecute` faz uma validação leve (RBAC, módulo disponível,
 *   contexto suficiente). Nunca dispara side-effects.
 * - `validate` (opcional) inspeciona o payload SEM side-effects e devolve
 *   os campos ainda faltantes. Usado pelo engine para orquestrar
 *   confirmação antes de disparar `execute`.
 * - `execute` valida o payload, chama o Service e devolve um resultado
 *   estruturado. Se faltar informação, devolve `missing_fields` SEM
 *   executar parcialmente a operação.
 * - `requiresConfirmation` sinaliza que a operação altera dados
 *   importantes; o engine pedirá confirmação humana antes de executar.
 * - `confirmationSummary` (opcional) gera a frase de confirmação para
 *   o payload atual. Se omitido, o engine usa o `name` da Skill.
 */
export interface BellaSkill<TPayload = BellaSkillPayload, TData = unknown> {
  readonly id: string;
  readonly name: string;
  readonly module: BellaModuleKey;
  readonly description: string;
  readonly requiresConfirmation?: boolean;
  canExecute(ctx: BellaSkillContext): boolean;
  validate?(payload: TPayload, ctx: BellaSkillContext): BellaSkillMissingField[];
  confirmationSummary?(payload: TPayload): string;
  execute(payload: TPayload, ctx: BellaSkillContext): Promise<BellaSkillResult<TData>>;
}

/** Helpers de construção de resultado — evita repetição nos handlers. */
export const skillResult = {
  success<T>(message: string, data?: T, suggestions?: BellaSkillSuggestion[]): BellaSkillResult<T> {
    return { ok: true, code: "success", message, data, suggestions };
  },
  missing(message: string, fields: BellaSkillMissingField[]): BellaSkillResult {
    return { ok: false, code: "missing_fields", message, missingFields: fields };
  },
  invalid(message: string): BellaSkillResult {
    return { ok: false, code: "invalid_payload", message };
  },
  unavailable(message: string): BellaSkillResult {
    return { ok: false, code: "module_unavailable", message };
  },
  notAllowed(message: string): BellaSkillResult {
    return { ok: false, code: "not_allowed", message };
  },
  error(message: string): BellaSkillResult {
    return { ok: false, code: "error", message };
  },
};
