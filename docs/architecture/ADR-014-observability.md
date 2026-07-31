# ADR-014 — Audit Sanitizer, Logger e Metrics

- **Status:** Accepted (Sprint 001.5)
- **Data:** 2026-07-28
- **Escopo:** `src/features/bella-ai/agent/infrastructure/{sanitizer,logger,metrics,trace}.ts`

## Contexto

`public.bella_executions.parameters` é um JSONB gravado a cada execução
do Agente. Sem uma camada de sanitização, qualquer payload que passasse
pelo Planner poderia carregar tokens, headers `Authorization`, senhas ou
PII sensível diretamente para o banco — violando o Security Gate.

Além disso, logs distribuídos no console não seguiam formato consistente,
dificultando correlação por `requestId`.

## Decisão

### Sanitizer (`sanitizer.ts`)

`sanitizeForAudit(value)` percorre a estrutura e:

- Redige valores de chaves que batem com a blacklist:
  `authorization`, `apikey`, `api[_-]?key`, `secret`, `token`,
  `password`, `pwd`, `session`, `cookie`, `service_role`,
  `supabase_anon|publishable`, `jwt`, `access_token`, `refresh_token`,
  `bearer`, `cpf`, `cnpj`.
- Redige strings com padrão de JWT (`a.b.c` base64url),
  chaves opacas Supabase (`sb_secret_*` / `sb_publishable_*`) e headers
  `Bearer ...`.
- Trunca strings > 2000 chars.
- Limita profundidade a 8 e arrays a 100 itens.

Todo escrita em `bella_executions.parameters` e todo log estruturado
passa por este sanitizer.

### Logger (`logger.ts`)

Emite JSON-line com `ts/level/component/message + fields`. Fields
passam por `sanitizeForAudit` antes de serem serializados. Nível mínimo
`debug` em dev, `info` em prod. `logger.child(base)` cria logger com
campos padrão (`requestId`, `companyId`, `userId`).

### Metrics (`metrics.ts`)

Buffer circular in-process (500 samples). Contadores + timings. Consumo
externo continua sendo via `bella_executions` (fonte de verdade), mas o
buffer permite inspeção no painel de debug.

### Trace (`trace.ts`)

`newTraceId(prefix)` — helper único para gerar identificadores de
requisição. Usado por `buildExecutionContext` quando o chamador não
informar um id.

## Consequências

- `bella_executions.parameters` deixa de ser um risco de vazamento.
- Correlação por `requestId` viável em qualquer ambiente.
- Blacklist evolutiva — nova chave sensível se adiciona em um lugar só.
