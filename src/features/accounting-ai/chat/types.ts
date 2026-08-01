/**
 * Bella Contadora — Chat (Sprint 5.4): contratos da camada conversacional.
 *
 * Nenhum cálculo financeiro vive aqui. O chat apenas interpreta a pergunta,
 * escolhe skills existentes, executa e traduz o resultado em texto.
 */
import type { AccountingSkillId } from "../skills";

/** Intenções reconhecidas pelo motor de intenção. */
export type BellaIntentId =
  | "consultar_receita"
  | "consultar_lucro"
  | "consultar_caixa"
  | "consultar_fluxo"
  | "consultar_dre"
  | "consultar_impostos"
  | "consultar_prolabore"
  | "consultar_reserva"
  | "consultar_produtos"
  | "consultar_ticket"
  | "consultar_clientes"
  | "consultar_saude"
  | "consultar_insights"
  | "consultar_alertas"
  | "consultar_recomendacoes"
  | "consultar_retirada"
  | "consultar_disponibilidade"
  | "consultar_risco"
  | "consultar_notificacoes"
  | "resumo_do_dia"
  | "situacao_geral"
  | "situacao_fiscal"
  | "situacao_estoque"
  | "situacao_vendas"
  | "situacao_compras"
  | "situacao_crm"
  | "pontos_atencao"
  | "situacao_tributaria"
  | "consultar_das"
  | "consultar_rbt12"
  | "consultar_anexo"
  | "consultar_aliquota"
  | "consultar_faixa"
  | "consultar_vencimento_das"
  | "simular_das"
  | "simular_faturamento"
  | "desconhecida";

export interface IntentMatch {
  intent: BellaIntentId;
  /** 0..1 — determinístico, baseado nos termos casados. */
  confidence: number;
  /** Termos que dispararam a intenção (auditoria/testes). */
  matched: string[];
  /** Valor monetário citado na pergunta, quando houver. */
  amount: number | null;
  /** true quando a intenção veio do contexto da conversa. */
  fromContext: boolean;
  /** Sprint 7.1 — crescimento percentual citado ("crescer 20%"). */
  growthPct?: number | null;
}

export interface ChatPlanStep {
  skillId: AccountingSkillId;
  reason: string;
}

export interface ChatPlan {
  intent: BellaIntentId;
  steps: ChatPlanStep[];
  /** Resposta consolidada (vários skills) ou pontual (um skill). */
  shape: "single" | "composite" | "none";
  amount: number | null;
  /** Sprint 7.1 — crescimento percentual citado, quando houver. */
  growthPct?: number | null;
}

export interface ChatSkillOutcome {
  skillId: AccountingSkillId;
  ok: boolean;
  text: string;
  data: unknown;
  error?: string;
}

export interface ChatAnswer {
  intent: BellaIntentId;
  text: string;
  skills: AccountingSkillId[];
  outcomes: ChatSkillOutcome[];
  /** true quando ao menos uma skill respondeu com dados. */
  answered: boolean;
  amount: number | null;
}

export type ChatRole = "user" | "bella";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** Skills utilizadas — somente nas mensagens da Bella. */
  skills: AccountingSkillId[];
  at: number;
}

export interface ChatContextState {
  lastIntent: BellaIntentId | null;
  lastSkills: AccountingSkillId[];
  lastAmount: number | null;
  updatedAt: number | null;
}
