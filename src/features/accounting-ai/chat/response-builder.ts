/**
 * Response Builder — puro. Converte os resultados determinísticos das skills
 * em uma resposta em linguagem natural. Nenhum número é recalculado aqui:
 * todo texto vem das skills.
 */
import { polish } from "../lib/response-format";
import type { BellaAnswerTrace } from "../telemetry/types";
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
  explicar_lucro: "Sobre o seu lucro:",
  explicar_caixa: "Sobre o seu caixa:",
  explicar_receita: "Sobre a sua receita:",
  explicar_despesas: "Sobre as suas despesas:",
  explicar_impostos: "Sobre os seus impostos:",
  explicar_ticket: "Sobre o seu ticket médio:",
  explicar_estoque: "Sobre o seu estoque:",
  explicar_resultado: "Sobre o resultado do período:",
  explicar_indicadores: "Sobre os seus indicadores:",
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
  explicar_lucro: "Todos os números vêm da DRE oficial do período.",
  explicar_receita: "Todos os números vêm da DRE e das métricas de vendas oficiais.",
  explicar_despesas: "Todos os números vêm da DRE oficial do período.",
  explicar_impostos: "Todos os números vêm do motor tributário oficial.",
  explicar_resultado: "Ranking calculado sobre os números oficiais do período.",
};

export const FALLBACK_UNKNOWN =
  "Ainda não sei responder isso. Posso falar sobre receita, lucro, caixa, fluxo, impostos, retirada, pró-labore, reserva, produtos, clientes, alertas e recomendações.";

export const FALLBACK_NO_DATA =
  "Não encontrei dados suficientes para responder com segurança.";

/** Sprint 7.4 — baixa confiança usa exatamente a mesma resposta. */
export const FALLBACK_LOW_CONFIDENCE = FALLBACK_NO_DATA;

function clean(text: string): string {
  return polish(text);
}

export interface BuildAnswerOptions {
  /** Sprint 7.4 — metadados internos de rastreabilidade (não exibidos). */
  trace?: BellaAnswerTrace;
}

export function buildAnswer(
  plan: ChatPlan,
  outcomes: ChatSkillOutcome[],
  options: BuildAnswerOptions = {},
): ChatAnswer {
  const skills = plan.steps.map((s) => s.skillId);
  const trace = options.trace;

  if (plan.intent === "desconhecida" || plan.shape === "none") {
    return {
      intent: plan.intent,
      text: FALLBACK_UNKNOWN,
      skills,
      outcomes,
      answered: false,
      amount: plan.amount,
      trace,
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
      trace,
    };
  }

  // Sprint 7.4 — sem confiança suficiente a Bella não tenta completar
  // a informação: ela avisa que não sabe.
  if (trace?.lowConfidence) {
    return {
      intent: plan.intent,
      text: FALLBACK_LOW_CONFIDENCE,
      skills,
      outcomes,
      answered: false,
      amount: plan.amount,
      trace,
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
    trace,
  };
}
