# Plano: Bella IA Fase 2 — Inteligência e Objetividade

Melhorar a inteligência e objetividade da Bella IA para que ela responda exatamente ao que foi perguntado, sem despejar informações não solicitadas, seguindo as novas diretrizes de resposta direcionada, estoque, financeiro e vendas.

## Alterações

### Core e IA
- **Interpretador de Intenção (OpenAI)**
  - Atualizar `INTERPRET_SYSTEM_PROMPT` em `src/features/bella-ai/ai/prompts/interpretPrompt.ts` para reforçar a objetividade e o formato de resposta.
  - O prompt instruirá o LLM a escolher a Skill mais específica e a gerar uma "response" preliminar curta que siga as regras de formatação (bullets, R$, títulos curtos).
- **Prompt de Sistema da Bella**
  - Refinar `BELLA_SYSTEM_PROMPT` em `src/features/bella-ai/ai/prompts/systemPrompt.ts` para alinhar com as regras de Resposta Direcionada, evitando relatórios completos quando não solicitados.

### Skills e Services (Lógica de Resposta)
- **Financeiro**
  - Ajustar `getCashBalanceSkill` em `src/features/bella-ai/skills/finance-skills.ts` e `financeSummarySkill` em `src/features/finance/v2/skills/finance-summary.skill.ts` para seguir o formato: 💰 Caixa • Saldo: R$ X • A receber: R$ X • A pagar: R$ X.
- **Estoque**
  - Ajustar `productListLowStockSkill` em `src/features/products/v2/skills/product-list-low-stock.skill.ts` e `stockLowSkill` em `src/features/inventory/v2/skills/index.ts` (ou o arquivo de implementação correspondente) para incluir contagem de críticos, estoque atual/mínimo e sugestão de compra.
- **Vendas / Executive Intelligence**
  - Ajustar `executiveSkills` (especialmente `companyStatusSkill` e `customerAttentionSkill`) em `src/features/bella-ai/executive/skills/executive-skills.ts` para garantir respostas curtas, específicas e com R$.

### Integração e Contexto
- **Continuidade**
  - Garantir que o `conversationContext` enviado para a OpenAI em `AgentRuntime.ts` inclua referências a entidades mencionadas anteriormente (clientes/produtos) para suportar perguntas como "E quanto ela gastou?".

## Detalhes Técnicos
- O sistema continuará usando o pipeline: `AgentRuntime` -> `Planner` -> `PermissionEngine` -> `SkillRegistry` -> `Services`.
- Nenhuma alteração em `companyId`, `userId`, `RLS` ou autenticação.
- Validação via `bunx tsgo` e `bun run build`.

## Testes Manuais
Validar as seguintes perguntas no painel "Perguntar à Bella":
1. "Qual é o saldo atual do meu caixa?" (Esperado: Formato 💰 Caixa curto)
2. "Quem mais compra?" (Esperado: Somente cliente e total)
3. "Quais produtos estão com estoque baixo?" (Esperado: Críticos, saldo, mínimo, sugestão)
4. "Quanto vendi este mês?" (Esperado: Receita líquida, número de vendas, ticket médio)
