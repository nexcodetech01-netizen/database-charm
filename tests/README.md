# NexOS — Suíte E2E (Playwright)

Testes end-to-end organizados por módulo. Estrutura:

```
tests/
  support/            # fixtures, helpers e factories reutilizáveis
  auth/               # login, logout, sessão
  dashboard/          # KPIs, alertas, insights
  products/           # CRUD + busca
  categories/
  suppliers/
  purchases/          # nova compra, recebimento
  inventory/          # entrada/saída/histórico
  customers/          # CRM, timeline
  sales/              # PDV, pagamento, estoque
  finance/            # AR/AP e fluxo
  bella-pay/          # sandbox + webhook fake
  agenda/             # criar/alterar/cancelar
  reports/            # carregamento + filtros
```

## Como executar

Configure as credenciais de teste (usuário previamente cadastrado no Supabase de dev):

```bash
export E2E_USER_EMAIL=teste@nexos.local
export E2E_USER_PASSWORD=•••••••
```

Comandos:

```bash
bun test:e2e         # headless
bun test:e2e:headed  # com browser visível
bun test:e2e:ui      # Playwright UI mode
```

Quando as variáveis `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` **não** estão
definidas, todos os testes que dependem de sessão autenticada são
automaticamente marcados como `skipped` (via `test.skip`). Isso permite
executar `bun test:e2e` em CI sem vazar credenciais e ainda validar a
compilação da suíte.

## Convenções

- Sempre usar `test` importado de `tests/support/fixtures` (fornece
  `authedPage`).
- Não criar dados diretamente no banco — todos os fluxos passam pela UI.
- Factories em `tests/support/factories.ts` geram nomes únicos.
- Nenhuma alteração de código de aplicação foi feita para acomodar os
  testes; seletores privilegiam papéis (`getByRole`) e labels visíveis.
