# ADR-011 — Bella como Agente Operacional do NexOS

- **Status:** Accepted (Sprint A5)
- **Data:** 2026-07-28
- **Escopo:** `src/features/bella-ai/agent/*` + tabela `public.bella_executions`.

## Contexto

A Bella IA já dispunha de Gateway de IA, Intent Router, Skills, Context Manager
e Orchestrator (pricing). Faltava um **pipeline canônico único** para toda
operação escrita, com **planejamento explícito, autorização RBAC antes do
side-effect, confirmação para operações destrutivas e auditoria persistente**.

## Decisão

Introduzir uma camada aditiva `src/features/bella-ai/agent/` que orquestra o
fluxo abaixo, sem alterar nada existente:

```
Conversation Manager
        │
        ▼
Bella Gateway (existente)
        │
        ▼
Intent Engine (AgentIntent)
        │
        ▼
Planner  ──►  AgentPlan (steps + requiresConfirmation)
        │
        ▼
Permission Engine (mapa Skill → PermissionCode + owner shortcut)
        │
        ▼
Skill Registry (existente)
        │
        ▼
Business Services  ──►  Supabase (RLS = última barreira)
        │
        ▼
Execution Log (bella_executions)
```

Regras invioláveis:

1. **Nenhuma Skill acessa Supabase diretamente.** Skill → Service → Repository.
2. **Nenhum passo é executado antes de checar `canExecuteSkill()`**.
3. **Operações destrutivas** (`destructive: true` no `SkillPermissionSpec`) ou
   marcadas pelo Intent Engine (`confirmationRequired`) **exigem `confirmed:true`**
   no `runAgent`.
4. **Toda execução é logada em `bella_executions`** — falhas de log jamais
   propagam para o pipeline.
5. **RLS continua sendo a última barreira**: a checagem local espelha
   `public.has_permission()`, mas a policy no banco não é substituída.

## Componentes

| Arquivo | Responsabilidade |
|---|---|
| `agent/types.ts` | `AgentContext`, `AgentIntent`, `AgentPlan`, `AgentResponse`. |
| `agent/permission-engine.ts` | Mapa Skill → `PermissionCode[]` + `canExecuteSkill`. |
| `agent/planner.ts` | Converte intent em `AgentPlan` (1:N steps). |
| `agent/execution-log.ts` | Insert idempotente em `bella_executions`. |
| `agent/observability.ts` | Agregações (total, sucesso, top skills/intents). |
| `agent/agent.ts` | `runAgent()` — pipeline canônico. |
| `agent/index.ts` | Barrel público. |

## Banco de Dados

Nova tabela `public.bella_executions` (migration 2026-07-28):

- Colunas: `company_id`, `user_id`, `conversation_id`, `intent`, `skill_id`,
  `parameters`, `confirmation_required`, `confirmed`, `success`, `result_code`,
  `error_message`, `execution_time_ms`, `started_at`, `finished_at`.
- Índices: `(company_id, started_at DESC)`, `(company_id, skill_id)`,
  `(company_id, intent)`.
- RLS:
  - `SELECT`: membros da empresa (`user_has_company_access(company_id)`).
  - `INSERT`: membro da empresa gravando o próprio `user_id`.
- Sem policy de `UPDATE`/`DELETE` — o log é append-only na prática.

## Como adicionar uma nova Skill ao Agente

1. Criar a Skill em `src/features/bella-ai/skills/<modulo>-skills.ts` e
   registrá-la em `skills/index.ts` (fluxo já existente).
2. Adicionar entrada em `SKILL_PERMISSION_MAP` (`agent/permission-engine.ts`)
   com `requires: PermissionCode[]` e `destructive: boolean`.
3. Adicionar mapeamento em `INTENT_TO_SKILL` (`agent/planner.ts`) se houver
   um novo `intent.id`.
4. (Opcional) Ajustar o Intent Engine para reconhecer a nova frase-gatilho.

Nenhuma alteração no `runAgent` é necessária — é o ponto do design.

## Como adicionar um novo Provider de IA

Continua valendo a interface `AIProvider` em `ai/gateway/AIProvider.ts`.
O Agente não conversa com providers diretamente: ele consome o resultado já
normalizado (`AIResult`) via `bellaAIGateway.interpret()`.

## Consequências

- **Positivas**: pipeline único, auditável, testável; RBAC obrigatório antes
  do side-effect; confirmação estruturada; base para métricas de produto.
- **Negativas**: duas camadas coexistem (Orchestrator legado + Agente). O
  legado permanece dedicado a intents de pricing (`commercial.*`); o Agente
  cobre intents operacionais (`customer.*`, `product.*`, `finance.*`, etc.).
  Consolidação em um único ponto de entrada será feita em ADR posterior.

## Alternativas rejeitadas

- **Executar Skills direto do Intent Router**: eliminaria o passo de plano e
  a checagem de permissão centralizada, e reintroduziria confirmações
  ad-hoc em cada Skill.
- **Substituir o Orchestrator existente**: quebraria o contrato de pricing
  (ADR-005/007/009) sem ganho imediato.

## Referências

Blueprint §13, §25; ADR-005, ADR-007, ADR-009; `docs/MODULES.md` (RBAC).
