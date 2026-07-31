# ADR-016 — Security Boundaries e CI Guards

- **Status:** Accepted (Sprint 001.5)
- **Data:** 2026-07-28
- **Escopo:** `eslint.config.js`, `.github/workflows/ci-guards.yml`,
  `src/features/bella-ai/agent/infrastructure/permission-cache.ts`

## Contexto

O Security Gate da Sprint 001.5 exige que:

- `supabaseAdmin` (service role) NUNCA seja usado em Skills, Services de
  negócio, componentes React ou hooks.
- Variáveis de ambiente `service_role` jamais apareçam em código de
  frontend.
- Todo `ZodObject` em Skill seja `.strict()`.
- Cache de permissões seja invalidado em `SIGNED_OUT` e mudanças de
  papel.

Sem enforcement automatizado, essas regras se degradam ao longo do
tempo.

## Decisão

### 1. Regras ESLint (`eslint.config.js`)

- `no-restricted-imports` bloqueia `@/integrations/supabase/client.server`
  em todo caminho **exceto** arquivos `*.server.ts` e
  `src/routes/api/**` (server routes públicas).
- `no-restricted-syntax` bloqueia:
  - `MemberExpression[object.property.name='env'][property.name=/SERVICE_ROLE/]`
    — acesso a `import.meta.env.*SERVICE_ROLE*` ou `process.env.*SERVICE_ROLE*`
    em código não-server.

### 2. CI Guard grep (`.github/workflows/ci-guards.yml`)

Job que roda em cada PR:

- `rg` procura por `supabaseAdmin` fora de `*.server.ts` /
  `src/routes/api/`.
- `rg` procura por `SUPABASE_SERVICE_ROLE_KEY` em qualquer arquivo
  fora de `*.server.ts`.
- `rg` procura por `z.object(` em `src/features/bella-ai/**` seguido
  imediatamente por handler sem `.strict()` (heurística).

Falha o job se qualquer padrão for encontrado.

### 3. Permission Cache (`permission-cache.ts`)

- TTL 60s por `(userId, companyId)`.
- Nunca persiste em `localStorage`.
- `invalidatePermissionsCache(userId?, companyId?)` deve ser chamado
  pelo `onAuthStateChange` no `__root.tsx` em `SIGNED_OUT` /
  `USER_UPDATED`.

## Consequências

- Regressões viram erro de build/CI, não incidente de segurança.
- `supabaseAdmin` continua disponível para arquivos `*.server.ts`
  legítimos (webhooks, jobs).
- Cache reduz round-trips ao `public.has_permission` sem risco de stale
  role após promoção/rebaixamento (invalidação explícita).
