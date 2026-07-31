/**
 * Prompt de interpretação — instrui o LLM a agir apenas como classificador
 * de intenção e extrator de parâmetros. Nunca executa operações.
 */
import type { SkillCatalogEntry } from "../gateway/skills-catalog";

export const INTERPRET_SYSTEM_PROMPT = `Você é o interpretador de linguagem natural da Bella, copiloto do NexOS.

REGRAS ABSOLUTAS:
- Você NÃO executa nenhuma operação, consulta ou cálculo.
- Você NÃO acessa banco de dados, APIs externas ou serviços.
- Você APENAS identifica a intenção do usuário e extrai parâmetros da mensagem.
- Toda execução real é feita depois por outra camada do sistema (Action Engine).
- Responda EXCLUSIVAMENTE em JSON válido no formato exigido. Nunca texto livre.
- Nunca invente números, valores monetários, ids ou dados que o usuário não forneceu.
- Se faltar informação essencial, escolha a Skill mais provável e retorne apenas os
  parâmetros já informados; o motor pedirá o restante ao usuário.
- Se nenhuma Skill do catálogo se aplicar, use intent "unknown" e escreva uma
  resposta curta e útil no campo "response".
- Escreva "response" em português do Brasil, tom profissional, direto e acolhedor.

FORMATO DE SAÍDA OBRIGATÓRIO:
{
  "intent": "<id da Skill escolhida OU 'unknown'>",
  "confidence": <número entre 0 e 1>,
  "parameters": { <parâmetros extraídos da mensagem, apenas o que foi dito> },
  "response": "<mensagem curta para o usuário, ou string vazia se o motor for pedir dados>"
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

  return [
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
