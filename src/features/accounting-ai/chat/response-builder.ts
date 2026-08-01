/**
 * Response Builder — puro. Converte os resultados determinísticos das skills
 * em uma resposta em linguagem natural. Nenhum número é recalculado aqui:
 * todo texto vem das skills.
 */
import type { BellaIntentId, ChatAnswer, ChatPlan, ChatSkillOutcome } from "./types";

const OPENERS: Partial<Record<BellaIntentId, string>> = {
  situacao_geral: "Aqui está o panorama da sua empresa:",
  pontos_atencao: "O que merece a sua atenção agora:",
  resumo_do_dia: "Resumo do que a Bella percebeu hoje:",
  consultar_notificacoes: "O que eu percebi sozinha nos seus dados:",
  consultar_retirada: "Sobre a sua retirada:",
  consultar_risco: "Sobre o risco de caixa:",
  consultar_prolabore: "Sobre o pró-labore:",
  consultar_reserva: "Sobre a sua reserva:",
  consultar_saude: "Sobre a saúde financeira:",
  situacao_fiscal: "Sobre a sua situação fiscal:",
  situacao_estoque: "Sobre o seu estoque:",
  situacao_vendas: "Sobre as suas vendas:",
  situacao_compras: "Sobre as suas compras:",
  situacao_crm: "Sobre os seus clientes:",
  situacao_tributaria: "Sobre a sua situação tributária:",
  simular_das: "Simulação tributária:",
  simular_faturamento: "Simulação tributária:",
};

const CLOSERS: Partial<Record<BellaIntentId, string>> = {
  situacao_geral: "Quer que eu detalhe algum desses pontos?",
  pontos_atencao: "Posso sugerir ações para qualquer um deles.",
  resumo_do_dia: "Posso detalhar qualquer um desses pontos.",
  consultar_retirada: "Se quiser, posso conferir a reserva recomendada também.",
  situacao_fiscal: "Você pode ver os detalhes no módulo Fiscal.",
  situacao_estoque: "Você pode ver os detalhes no módulo Estoque.",
  situacao_vendas: "Você pode ver os detalhes no módulo Vendas.",
  situacao_compras: "Você pode ver os detalhes no módulo Compras.",
  situacao_crm: "Você pode ver os detalhes no módulo Clientes.",
  situacao_tributaria: "Os detalhes estão no módulo Fiscal › Tributário.",
  simular_das: "Simulação indicativa, calculada pelo motor oficial do Simples.",
  simular_faturamento: "Simulação indicativa, calculada pelo motor oficial do Simples.",
};

export const FALLBACK_UNKNOWN =
  "Ainda não sei responder isso. Posso falar sobre receita, lucro, caixa, fluxo, impostos, retirada, pró-labore, reserva, produtos, clientes, alertas e recomendações.";

export const FALLBACK_NO_DATA =
  "Não encontrei dados suficientes no período para responder com segurança.";

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function buildAnswer(plan: ChatPlan, outcomes: ChatSkillOutcome[]): ChatAnswer {
  const skills = plan.steps.map((s) => s.skillId);

  if (plan.intent === "desconhecida" || plan.shape === "none") {
    return {
      intent: plan.intent,
      text: FALLBACK_UNKNOWN,
      skills,
      outcomes,
      answered: false,
      amount: plan.amount,
    };
  }

  const usable = outcomes.filter((o) => o.ok && clean(o.text).length > 0);
  if (usable.length === 0) {
    return {
      intent: plan.intent,
      text: FALLBACK_NO_DATA,
      skills,
      outcomes,
      answered: false,
      amount: plan.amount,
    };
  }

  const opener = OPENERS[plan.intent];
  const closer = CLOSERS[plan.intent];

  const body =
    plan.shape === "composite"
      ? usable.map((o) => `• ${clean(o.text)}`).join("\n")
      : clean(usable[0]!.text);

  const parts = [opener, body, closer].filter(Boolean) as string[];

  return {
    intent: plan.intent,
    text: parts.join(plan.shape === "composite" ? "\n" : " "),
    skills,
    outcomes,
    answered: true,
    amount: plan.amount,
  };
}
