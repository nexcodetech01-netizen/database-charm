/**
 * Prompts usados para orientar a IA sobre as Skills/Tools disponíveis.
 * Mantém prompts fora de componentes/services.
 */

export interface ToolPromptEntry {
  id: string;
  name: string;
  description: string;
  /** Campos obrigatórios em formato "campo: descrição". */
  requiredFields?: string[];
}

export function buildToolPrompt(tools: ToolPromptEntry[]): string {
  if (tools.length === 0) {
    return "Nenhuma ferramenta disponível no momento. Responda apenas de forma informativa.";
  }
  const lines = tools.map((t) => {
    const fields =
      t.requiredFields && t.requiredFields.length > 0
        ? `\n  Campos: ${t.requiredFields.join(", ")}`
        : "";
    return `- [${t.id}] ${t.name}: ${t.description}${fields}`;
  });
  return [
    "Ferramentas disponíveis (use apenas estas — nunca invente):",
    ...lines,
    "",
    "Formato esperado ao acionar uma ferramenta:",
    '{ "intent": "<id>", "parameters": { ... }, "confidence": 0..1 }',
  ].join("\n");
}
