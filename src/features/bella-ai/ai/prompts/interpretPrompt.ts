/**
 * Prompt de interpretação — instrui o LLM a agir apenas como classificador
 * de intenção e extrator de parâmetros. Nunca executa operações.
 */
import type { SkillCatalogEntry } from "../gateway/skills-catalog";

export const INTERPRET_SYSTEM_PROMPT = `Você é o interpretador de linguagem natural da Bella, copiloto do NexOS.

REGRAS ABSOLUTAS:
- Você NÃO executa nenhuma operação, consulta ou cálculo.
- Você APENAS identifica a intenção do usuário e extrai parâmetros da mensagem.
- Responda EXCLUSIVAMENTE em JSON válido no formato exigido. Nunca texto livre.
- Se nenhuma Skill se aplicar, use intent "unknown" e escreva uma resposta curta no campo "response".

OBJETIVIDADE E DIRECIONAMENTO (FASE 3 — EXECUTORA):
- Seja extremamente específico. Responda APENAS o que foi perguntado.
- Se o usuário pedir para ALTERAR algo (estoque, preço, criar cliente), identifique a Skill correta.
- A Bella deve ser capaz de realizar ações reais com confirmação.
- Se perguntar "Saldo do caixa", responda apenas o saldo e obrigações imediatas.
- A "response" deve ser curta, preferindo bullets (•) e títulos curtos.
- Use R$ para valores monetários e números em destaque quando apropriado.

CONTINUIDADE E CONTEXTO:
- O "conversationContext" pode conter referências a entidades mencionadas (ex.: "lastCustomer").
- Se o usuário perguntar "E quanto ela gastou?", entenda que "ela" se refere ao cliente no contexto.

FORMATO DE SAÍDA OBRIGATÓRIO:
{
  "intent": "<id da Skill escolhida OU 'unknown'>",
  "confidence": <número entre 0 e 1>,
  "parameters": { <parâmetros extraídos> },
  "response": "<resposta curta, formatada e direcionada seguindo as regras da FASE 2>"
}`;

export function buildInterpretUserPrompt(
  message: string,
  skills: SkillCatalogEntry[],
  conversationContext?: Record<string, unknown> | null,
): string {
  const catalog = skills.map((s) => ({
    id: s.id,
    name: s.name,
    module: s.module,
    description: s.description,
    requiresConfirmation: s.requiresConfirmation,
  }));

  // BUG ENCONTRADO E CORRIGIDO (2026-08-31): o prompt nunca informava
  // qual é a data de HOJE — sem isso, o GPT não tem como calcular
  // corretamente períodos relativos ("este mês", "essa semana",
  // "ontem"), e pode usar uma data completamente errada baseada só no
  // que ele "acha" que é hoje. Isso fazia perguntas como "quanto vendi
  // esse mês" devolverem "nenhum pedido encontrado" mesmo havendo
  // vendas reais no período — o intervalo de datas calculado pelo GPT
  // não batia com o período real.
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    .toISOString()
    .slice(0, 10);
  const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0)
    .toISOString()
    .slice(0, 10);

  return [
    "DATA DE HOJE (use isso pra calcular qualquer período relativo — nunca invente ou suponha outra data):",
    JSON.stringify({
      hoje: todayIso,
      inicio_deste_mes: firstDayOfMonth,
      inicio_do_mes_passado: firstDayOfLastMonth,
      fim_do_mes_passado: lastDayOfLastMonth,
    }, null, 2),
    "",
    "CATÁLOGO DE SKILLS DISPONÍVEIS:",
    JSON.stringify(catalog, null, 2),
    "",
    "CONTEXTO DA CONVERSA:",
    JSON.stringify(conversationContext ?? {}, null, 2),
    "",
    "MENSAGEM DO USUÁRIO:",
    message,
    "",
    'Responda APENAS com o JSON no formato exigido — sem markdown, sem cercas de código.',
  ].join("\n");
}
