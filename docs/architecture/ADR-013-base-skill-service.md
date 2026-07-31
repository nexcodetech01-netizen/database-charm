# ADR-013 — BaseSkill / BaseService

- **Status:** Accepted (Sprint 001.5)
- **Data:** 2026-07-28
- **Escopo:** `src/features/bella-ai/agent/infrastructure/base-skill.ts`,
  `.../base-service.ts`

## Contexto

Skills eram escritas ad-hoc: cada uma validava payload à mão, checava
permissão de forma inconsistente e não emitia métricas/log padronizados.
Não havia enforcement de `.strict()` no Zod nem gate de confirmação para
operações destrutivas fora do Planner.

## Decisão

Introduzir `defineBaseSkill(spec)` — factory que embrulha o handler no
pipeline canônico:

```
validate() → permission() → confirm() → execute() → audit() → metrics()
```

Regras:

1. `schema` DEVE ser um `ZodObject.strict()`. Verificado em tempo de
   construção — falha rápido em desenvolvimento.
2. `requiredPermissions` é lista de `PermissionCode`. `security.can()`
   basta ter UMA (owner passa sempre).
3. `destructive: true` exige `confirmed: true`; senão devolve a
   `confirmationSummary` como mensagem para o cliente confirmar.
4. Handler recebe **payload já parseado e tipado** + ExecutionContext.
5. Métricas emitidas por skill: `bella.skill.{invalid,forbidden,error,success,failure}` + `duration_ms`.
6. Logs sempre sanitizados via `sanitizeForAudit` (ADR-014).

`BaseService` é a base para Services de negócio consumidos por Skills.
Injeta o `supabase` autenticado do ExecutionContext e provê `log`/`metrics`
scoped. Nenhuma subclasse pode importar `supabaseAdmin` — regra de lint
(ADR-016).

## Consequências

- Skills novas escritas em ~30 LOC, sem código de auditoria repetido.
- Skills existentes (`customer-skills.ts` etc.) permanecem intactas —
  migração incremental.
- Cobertura de teste padronizada — 5 cenários mínimos (invalid, forbidden,
  destructive+confirm, destructive+no-confirm, success).
