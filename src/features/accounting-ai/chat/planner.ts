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
  /** Sprint 6.6 — "como estão meus clientes?": só skills já existentes. */
  situacao_crm: [
    "consultar_clientes",
    "consultar_ticket",
    "consultar_alertas",
    "consultar_recomendacoes",
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
  /** Sprint 7.1 — tributário: skills que leem o motor oficial do Simples. */
  situacao_tributaria: [
    "consultar_das",
    "consultar_rbt12",
    "consultar_faixa",
    "consultar_aliquota",
    "consultar_vencimento_das",
  ],
  consultar_das: ["consultar_das"],
  consultar_rbt12: ["consultar_rbt12"],
  consultar_anexo: ["consultar_anexo"],
  consultar_aliquota: ["consultar_aliquota"],
  consultar_faixa: ["consultar_faixa"],
  consultar_vencimento_das: ["consultar_vencimento_das"],
  simular_das: ["simular_tributos"],
  simular_faturamento: ["simular_tributos"],
  /** Sprint 7.2 — auditoria: skills de leitura pura. */
  auditoria_geral: ["auditar_empresa", "consultar_inconsistencias"],
  consultar_inconsistencias: ["consultar_inconsistencias"],
  consultar_saude_operacional: [
    "consultar_saude_operacional",
    "consultar_inconsistencias",
  ],
  /** Sprint 7.3 — Bella Explica: explicações sobre dados oficiais. */
  explicar_lucro: ["explicar_lucro"],
  explicar_caixa: ["explicar_caixa"],
  explicar_receita: ["explicar_receita"],
  explicar_despesas: ["explicar_despesas"],
  explicar_impostos: ["explicar_impostos"],
  explicar_ticket: ["explicar_ticket"],
  explicar_estoque: ["explicar_estoque"],
  explicar_resultado: ["explicar_resultado"],
  explicar_indicadores: ["explicar_indicadores"],
  consultar_distribuicao: ["consultar_prolabore_recomendado", "consultar_retirada"],
  simular_distribuicao: ["simular_retirada"],
  auditar_fechamento: ["auditar_empresa", "consultar_alertas", "consultar_insights"],
  consultar_prontidao_fechamento: ["auditar_empresa", "consultar_saude"],
  identificar_problemas_fechamento: ["consultar_alertas", "consultar_inconsistencias"],
  resumo_mensal_executivo: ["consultar_saude", "consultar_insights", "consultar_alertas"],
  como_foi_meu_mes: ["consultar_saude", "consultar_receita", "consultar_insights"],
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
  consultar_das: "DAS da competência (motor oficial)",
  consultar_rbt12: "RBT12 e uso do teto do Simples",
  consultar_faixa: "Faixa do Simples",
  consultar_aliquota: "Alíquota efetiva",
  consultar_vencimento_das: "Vencimento do DAS",
  simular_tributos: "Simulação tributária oficial",
  auditar_empresa: "Auditoria completa dos dados oficiais",
  consultar_inconsistencias: "Inconsistências encontradas",
  consultar_saude_operacional: "Saúde operacional da empresa",
  explicar_lucro: "Explicação da variação do lucro",
  explicar_caixa: "Explicação da posição de caixa",
  explicar_receita: "Explicação da variação da receita",
  explicar_despesas: "Explicação da variação das despesas",
  explicar_impostos: "Explicação do imposto apurado",
  explicar_ticket: "Explicação do ticket médio",
  explicar_estoque: "Explicação da situação do estoque",
  explicar_resultado: "Ranking dos maiores impactos do período",
  explicar_indicadores: "Panorama explicado dos indicadores",
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
    return {
      intent: match.intent,
      steps: [],
      shape: "none",
      amount: match.amount,
      growthPct: match.growthPct ?? null,
    };
  }

  const skills = (PLANS[match.intent] ?? []).filter((id) => available.has(id));
  if (skills.length === 0) {
    return {
      intent: match.intent,
      steps: [],
      shape: "none",
      amount: match.amount,
      growthPct: match.growthPct ?? null,
    };
  }

  return {
    intent: match.intent,
    steps: skills.map((skillId) => ({
      skillId,
      reason: REASONS[skillId] ?? "Consulta necessária para responder",
    })),
    shape: skills.length > 1 ? "composite" : "single",
    amount: match.amount,
    growthPct: match.growthPct ?? null,
  };
}
