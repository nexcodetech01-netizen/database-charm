/**
 * Planner — puro. Traduz uma intenção em um plano de execução de skills
 * já existentes. Não executa nada, não acessa dados.
 */
import type { AccountingSkillId } from "../skills";
import { accountingAiSkills } from "../skills";
import type { BellaIntentId, ChatPlan, IntentMatch } from "./types";

const PLANS: Record<Exclude<BellaIntentId, "desconhecida">, AccountingSkillId[]> = {
  situacao_geral: [
    "consultar_saude",
    "consultar_caixa",
    "consultar_receita",
    "consultar_insights",
    "consultar_alertas",
  ],
  pontos_atencao: ["consultar_alertas", "consultar_insights"],
  /** Sprint 6.2 — "como está meu fiscal?": só skills já existentes. */
  situacao_fiscal: [
    "consultar_saude",
    "consultar_alertas",
    "consultar_recomendacoes",
    "consultar_notificacoes",
  ],
  /** Sprint 6.3 — "como está meu estoque?": só skills já existentes. */
  situacao_estoque: [
    "consultar_produtos",
    "consultar_alertas",
    "consultar_recomendacoes",
    "consultar_notificacoes",
  ],
  /** Sprint 6.4 — "como estão minhas vendas?": só skills já existentes. */
  situacao_vendas: [
    "consultar_receita",
    "consultar_ticket",
    "consultar_produtos",
    "consultar_clientes",
    "consultar_recomendacoes",
  ],
  /** Sprint 6.5 — "como estão minhas compras?": só skills já existentes. */
  situacao_compras: [
    "consultar_produtos",
    "consultar_alertas",
    "consultar_recomendacoes",
    "consultar_notificacoes",
  ],
  resumo_do_dia: [
    "consultar_alertas",
    "consultar_insights",
    "consultar_recomendacoes",
    "consultar_notificacoes",
  ],
  consultar_notificacoes: ["consultar_notificacoes"],
  consultar_receita: ["consultar_receita"],
  consultar_lucro: ["consultar_lucro"],
  consultar_caixa: ["consultar_caixa"],
  consultar_fluxo: ["consultar_fluxo"],
  consultar_dre: ["consultar_dre"],
  consultar_impostos: ["consultar_impostos"],
  consultar_prolabore: ["consultar_prolabore"],
  consultar_reserva: ["consultar_reserva"],
  consultar_produtos: ["consultar_produtos"],
  consultar_ticket: ["consultar_ticket"],
  consultar_clientes: ["consultar_clientes"],
  consultar_saude: ["consultar_saude", "consultar_insights", "consultar_caixa"],
  consultar_insights: ["consultar_insights"],
  consultar_alertas: ["consultar_alertas"],
  consultar_recomendacoes: ["consultar_recomendacoes"],
  consultar_retirada: ["consultar_retirada"],
  consultar_disponibilidade: ["consultar_disponibilidade"],
  consultar_risco: ["consultar_risco"],
};

const REASONS: Partial<Record<AccountingSkillId, string>> = {
  consultar_saude: "Score de saúde financeira",
  consultar_caixa: "Posição de caixa",
  consultar_receita: "Receita apurada",
  consultar_insights: "Insights determinísticos",
  consultar_alertas: "Alertas críticos",
  consultar_notificacoes: "Notificações proativas da Bella",
  consultar_retirada: "Consultoria de retirada",
  consultar_lucro: "Lucro apurado",
  consultar_produtos: "Ranking de produtos e estoque",
};

export interface PlanOptions {
  /** Skills disponíveis — por padrão o registro completo da Bella. */
  availableSkills?: readonly AccountingSkillId[];
}

export function planIntent(match: IntentMatch, options: PlanOptions = {}): ChatPlan {
  const available = new Set<AccountingSkillId>(
    options.availableSkills ?? accountingAiSkills.map((s) => s.id),
  );

  if (match.intent === "desconhecida") {
    return { intent: match.intent, steps: [], shape: "none", amount: match.amount };
  }

  const skills = (PLANS[match.intent] ?? []).filter((id) => available.has(id));
  if (skills.length === 0) {
    return { intent: match.intent, steps: [], shape: "none", amount: match.amount };
  }

  return {
    intent: match.intent,
    steps: skills.map((skillId) => ({
      skillId,
      reason: REASONS[skillId] ?? "Consulta necessária para responder",
    })),
    shape: skills.length > 1 ? "composite" : "single",
    amount: match.amount,
  };
}
