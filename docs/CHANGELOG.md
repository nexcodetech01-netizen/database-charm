# NexOS — Changelog

> Histórico oficial de mudanças do projeto. Segue o padrão [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) adaptado ao fluxo de sprints do NexOS.
>
> Formato de versão: `MAJOR.MINOR.PATCH` (Semantic Versioning).
> Cada entrada referencia a **sprint** correspondente do `ROADMAP.md`.

---

## [Unreleased] — RC1-HARDENING — Endurecimento pré-piloto

> Sprint focada em fechar as pendências 🟠 da auditoria RC1 sem alterar regra de negócio, RLS, banco ou UI. Zero migrations. Apenas superfície pública, testes e docs.

### Adicionado
- **`src/lib/rate-limit.server.ts`** — rate limiter server-only por IP com janela deslizante em memória e GC oportunista. Helpers `checkRateLimit`, `rateLimitResponse` e `enforceRateLimit`. Log estruturado no bloqueio (`[rate-limit] blocked route=… ip=… retryAfter=…s`). Resolve IP via `getRequestIP({ xForwardedFor: true })` com fallback para `cf-connecting-ip` / `x-forwarded-for`. **Nota operacional**: no runtime Cloudflare Workers cada isolate mantém seu próprio Map — primeira linha de defesa contra scraping/replay trivial; um limitador distribuído (KV/Durable Objects) fica no roadmap.
- **`src/features/catalog/lib/preview-auth.server.ts`** — `authorizePreview(supabaseAdmin, companyId)` verifica o Bearer JWT e confirma que `profiles.current_company_id === companyId`. Devolve tag (`no_token`/`invalid_token`/`no_company`/`forbidden`) sem lançar.
- **`tests/catalog/catalog.spec.ts`** — cobertura E2E do catálogo público: 404 amigável para slug inexistente, `?preview=1` anônimo continua 404, burst de 80 req contra `/api/public/catalog/*` deve retornar ao menos um 429, e (com `E2E_CATALOG_SLUG`) render da coleção + filtro por texto.

### Alterado — RC1-001 Rate limiting nas rotas públicas
- **`src/routes/api/public/catalog/$slug.ts`** — 60 req/min por IP (`catalog:collection`).
- **`src/routes/api/public/catalog/$slug/product/$productId.ts`** — 60 req/min por IP (`catalog:product`).
- **`src/routes/api/public/meta.oauth.callback.ts`** — 20 req/min por IP (`meta:oauth-callback`).
- **`src/routes/api/public/bella-pay/webhook.$token.ts`** — 300 req/min por IP (`bella-pay:webhook`, mais generoso porque assinado por token + eventos legítimos podem bursta).

### Alterado — RC1-003 Preview do catálogo autenticado
- **`src/routes/api/public/catalog/$slug.ts`** — coleções `scheduled` só respondem se `?preview=1` **E** o Bearer do chamador pertencer à empresa dona (`authorizePreview`). Anônimo recebe `404 not_found` (nunca revela existência).
- **`src/routes/api/public/catalog/$slug/product/$productId.ts`** — mesmo tratamento para produtos de coleção `scheduled`.
- **`src/features/catalog/lib/public-collection.functions.ts`** e **`.../public-product.functions.ts`** — o server function loader agora encaminha o header `Authorization` do chamador para a rota HTTP interna somente quando `preview: true`. Em navegações client-side de usuários logados, o auth-attacher middleware já injeta o Bearer automaticamente; SSR anônimo continua sem token e portanto sem preview.

### RC1-005 Auditoria final
- `tsgo --noEmit` — limpo após o hardening.
- Nenhuma migration, nenhuma alteração de RLS, nenhuma mudança em service/repositório de domínio, nenhuma alteração de UI.

### Não alterado (garantido)
- Domain/Application/Infrastructure de Pricing, Bella IA, PDV, Financeiro, CRM, Compras, Estoque, Produtos, Agenda, Marketing.
- Schema de banco, triggers, policies RLS, roles/permissions.
- Rotas autenticadas, layout, sidebar, design system.

---

## [Unreleased] — GO LIVE 2.0 — Product Hardening

> Sprint sem novas funcionalidades. Foco em observabilidade, segurança de superfície de banco, testes e documentação. Pricing Platform, Bella IA e arquitetura permaneceram intactas.

### Adicionado
- **`src/lib/observability.ts`** — logger estruturado (JSON linha-a-linha) e helper `readOrCreateCorrelationId(request)`. Redação automática de chaves sensíveis (`token`, `password`, `authorization`, `apiKey`, `cookie`, `secret`, `set-cookie`, `refresh_token`, `access_token`, `apikey`, `api_key`) em qualquer profundidade. `Logger.span(event, ctx, fn)` mede duração, marca `ok`, e re-lança erros preservando stack. Uso opcional em Server Functions, Use Cases, Pricing e Bella IA — infraestrutura, não um módulo/feature.
- **`src/lib/__tests__/observability.test.ts`** — 8 testes cobrindo emissão JSON, redação PII, `span` ok/erro, herança via `child`, e parsing/geração de correlation id (rejeita valores fora do regex `/^[\w-]{6,128}$/`).
- **`docs/HARDENING_REPORT.md`** — checklist operacional, evidências e classificação final do sistema.

### Segurança (migração)
- **`revoke_execute_from_trigger_only_security_definer_functions`** — revogado `EXECUTE` de `PUBLIC`/`anon`/`authenticated` em 10 funções `SECURITY DEFINER` invocadas exclusivamente por triggers: `apply_inventory_movement`, `apply_sale_to_inventory`, `apply_purchase_to_inventory`, `apply_sale_to_finance`, `apply_purchase_to_finance`, `bump_customer_last_interaction`, `log_appointment_event`, `log_opportunity_event`, `update_updated_at_column`, `rls_auto_enable`.
- `has_permission(uuid, uuid, text)` e `user_owns_company(uuid)` explicitamente revogadas de `anon` e mantidas para `authenticated` (necessárias em policies RLS — padrão oficial conforme knowledge).
- Resultado da auditoria: **11 → 2 warnings** no linter (`has_permission`/`user_owns_company`, obrigatoriamente `SECURITY DEFINER` para RLS). Nenhuma nova policy afetada, nenhuma escrita bloqueada, comportamento das triggers preservado.

### Verificações
- `tsgo --noEmit` — limpo.
- Vitest — **354/354** testes verdes antes; **362/362** após o logger (8 novos).
- `slow_queries` — nenhuma consulta com `total_ms` acima de 200ms ou `mean_ms` acima de 3ms nas últimas horas de operação.

### Não alterado (garantido)
- Pricing Engine, Application Layer, Resolver, Persistence, Bella IA (`ai/*`), server functions, RLS policies existentes, UI, rotas, schema de tabelas, triggers em si.

---

## [Unreleased] — UX-002 — Redesign do Workspace Nova Venda

### Alterado (apenas camada visual)
- **`src/features/sales/components/sale-form.tsx`** — migrado 100% para a UX Foundation: `PageLayout` (envelope + breadcrumb + header + aside), `KpiSection` + `KpiCard` (Itens · Unidades · Subtotal · Total), `FormSection` + `FormGrid` (Cliente → Produtos → Pagamento → Observações) e `DetailPanel` + `SummaryRow` (resumo lateral fixo com forma de pagamento e botão **Finalizar venda**).
- Cliente promovido a **primeiro bloco visual** com card de destaque (avatar, popover de busca, faixa de relacionamento: documento, telefone, e-mail, cidade/UF, nº de interações, link para ficha). Nenhuma query alterada — reutiliza `useCustomer`/`useCustomerInteractions`.
- Produtos ocupam o maior espaço da coluna principal via `SaleItemsEditor` intacto.
- **`src/routes/_authenticated/vendas_.novo.tsx`** e **`src/routes/_authenticated/vendas_.$saleId.editar.tsx`** — removidos wrappers manuais (`max-w-5xl`, back-button, `<h1>`/`<p>` duplicados). Cabeçalho, breadcrumb e voltar agora vêm do `PageLayout` dentro do `SaleForm`. Novo prop opcional `backHref`/`backLabel` para o retorno contextual da edição.

### Não alterado (garantido)
- Schema Zod (`number`, `sale_date`), estado local, `useCreateSale`/`useUpdateSale`, `computeTotals`, `computeSaleMetrics`, integração Bella Pay, cálculos de desconto/frete/margem, validações de item, controle de estoque, navegação pós-salvar e regra de finalização (`status = "paid"` + `paid_at`).
- Banco, RLS, hooks, services, mutations, queries — intactos.

---

## [Unreleased] — UX-001 — Fundação Visual do NexOS

### Adicionado
- **`PageLayout`** (`src/components/layout/page-layout.tsx`) — envelope visual único de todas as telas: breadcrumb + header + KPIs + toolbar + conteúdo + aside opcional, com largura máxima (`max-w-7xl`), padding responsivo e espaçamento vertical padronizados.
- **`KpiSection`** (`src/components/layout/kpi-section.tsx`) — grid responsivo (1 → 2 → 4 col) para blocos de KPIs. Substitui todas as variações locais de `grid grid-cols-*` para cards de resumo.
- **Barrel** `src/components/layout/index.ts` — import único (`from "@/components/layout"`) para `PageLayout`, `PageHeader`, `BreadcrumbNav`, `KpiSection`, `KpiCard`, `SectionToolbar`, `FormSection`, `FormGrid`, `DetailPanel`, `EmptyState`, `ListSkeleton`, `MoneyValue`.

### Documentação
- `docs/UX_GUIDELINES.md` — nova **seção 10** "Fundação Visual — `PageLayout` + `KpiSection`" com ordem canônica de blocos, exemplo completo e regras de migração.

### Não alterado (garantido)
- Banco, Supabase, RLS, hooks, services, React Query, rotas, regras de negócio e lógica de qualquer módulo. Esta entrega é **exclusivamente estrutura visual reutilizável** — nenhum módulo foi migrado nesta sprint.

---

## [0.25.0-rc.2] — Sprint 20 — UX Premium + Homologação Geral


### Fundação de UI compartilhada
- **`PageHeader`** ganhou props opcionais `icon` (ícone circular à esquerda no padrão premium) e `meta` (slot para badges/contadores ao lado do título). Retro-compatível.
- Novo componente **`BreadcrumbNav`** (auto-derivado da rota, com mapa oficial dos módulos NexOS) renderizado globalmente no `AppLayout`, imediatamente abaixo do Topbar.
- Novos utilitários compartilhados: **`SectionToolbar`** (busca + filtros + ações), **`ListSkeleton`** / **`CardsSkeleton`** (loading padronizado), **`Kbd`** (chip visual para atalhos como `Enter` para salvar).

### Layout & navegação
- `AppLayout` agora expõe **um único `<main id="main-content">`** com fade-in `motion-safe` para transição suave entre rotas.
- Router com **preload por intent** (`defaultPreload: "intent"` + `defaultPreloadDelay: 50`), reduzindo latência percebida ao navegar entre módulos.
- Breadcrumb com foco visível, `aria-current="page"` e link "Início" com `sr-only` para leitores de tela.

### Acessibilidade
- Landmark `<main>` único (correção de A11y).
- Foco visível nos crumbs e nos botões-âncora do sidebar.
- Ícones decorativos anotados com `aria-hidden`.

### Performance percebida
- Preload por intent nas rotas.
- Skeletons compartilhados prontos para substituir os fallback textuais "Carregando…" restantes.

### Pendências (Sprint 20.1 candidata)
- Aplicar `PageHeader.icon`/`meta`, `SectionToolbar` e `ListSkeleton` de forma sistemática em todas as 14 rotas (base já pronta — apenas adoção incremental).
- Menu mobile (hambúrguer) para o Sidebar (`hidden md:flex` hoje) — introdução do `Sheet` mobile.
- Colunas configuráveis nas tabelas grandes (Vendas, Compras, Financeiro).
- Auditoria de contraste automatizada (Axe) em CI.

### Classificação
**RC2** — pronto para homologação assistida. Sem alterações em regras de negócio, banco, RLS, Auth, integrações ou arquitetura.

---



## [0.24.2] — Sprint 19.2 — Refinamento do módulo Vendas

### Vendas
- Fluxo guiado agora em 5 etapas explícitas: **1. Cliente → 2. Itens → 3. Descontos e frete → 4. Pagamento → 5. Observações**.
- Seção **Pagamento** isolada, com mensagem de ajuda explicando que a forma de pagamento é obrigatória apenas para finalizar (rascunhos permitidos sem ela).
- Resumo lateral passou a exibir **quantidade de linhas e total de unidades** (`3 (12 un.)`) para leitura rápida do carrinho.
- Mantidos: bloqueio de itens até seleção do cliente, autopreenchimento de preço/custo/SKU/estoque/imagem, alertas de estoque insuficiente por linha e agregado, cálculo em tempo real de subtotal/descontos/frete/total/lucro/margem.

---

## [0.24.1] — Sprint 19.1 — Refinamento dos Fluxos Comerciais

### Vendas
- Fluxo guiado em 3 etapas: **1. Cliente → 2. Itens → 3. Pagamento**.
- Adição de produtos **bloqueada** até que o cliente seja selecionado (com placeholder informativo).
- Busca de produto carrega automaticamente **preço, custo, SKU, estoque e imagem** (via `product-images` bucket).
- Cada linha de item exibe SKU + estoque disponível; alerta visual de **estoque insuficiente** quando a quantidade excede o disponível.
- **Resumo lateral sticky** com Subtotal, Descontos, Frete, Total, contagem de itens e cliente selecionado.
- Cálculo em tempo real de **Lucro estimado** e **Margem (%)** quando os itens possuem custo cadastrado.
- Aviso agregado de estoque insuficiente no resumo.

### Compras
- Layout com **resumo lateral sticky** destacando fornecedor, status (badge tonificado), previsão de entrega, produtos, desconto, frete, seguro, outros custos e total geral em tempo real.
- Subtotal de custos extras destacado.

### Financeiro
- Métricas superiores reorganizadas: **Saldo, Fluxo Previsto, A Receber, A Pagar** + linha secundária com **Receitas do mês** e **Despesas do mês**.
- Cards com accent color por tipo de indicador (primary/success/danger).

### Bella Pay
- Novo **`ChargeDetailDialog`**: exibe status com ícone, valor bruto/líquido, vencimento, QR Code PIX, código copia-e-cola (com botão "Copiar"), cliente/venda vinculados e **timeline** (Criada → Vencimento → Paga/Cancelada).
- Após criar cobrança, o detalhe é aberto **automaticamente**.
- Linhas da tabela agora abrem o detalhe ao clique; ação "Ver detalhes" adicionada.
- Confirmação visual (banner verde) quando o pagamento está confirmado.

### Arquivos alterados
- `src/features/sales/types.ts` — draft com campos transientes (SKU, imagem, custo, estoque) e `computeSaleMetrics`.
- `src/features/sales/components/sale-items-editor.tsx` — gating, imagens, custo/estoque, alertas.
- `src/features/sales/components/sale-form.tsx` — fluxo guiado + resumo sticky + métricas.
- `src/features/purchases/components/purchase-form.tsx` — layout 2-colunas + resumo sticky.
- `src/features/finance/components/finance-metrics.tsx` — reorganização e cards mensais.
- `src/features/bella-pay/components/charge-detail-dialog.tsx` — **novo**.
- `src/features/bella-pay/components/charges-panel.tsx` — integração do detalhe + auto-abertura.

### Não alterado
- Nenhum módulo fora de Vendas/Compras/Financeiro/Bella Pay.
- Nenhuma migração de banco, RLS ou policy.
- Arquitetura, providers, roteamento e Design System preservados.



## [0.24.0] — Sprint 18 — Testes Automatizados (Playwright)

### Adicionado
- `playwright.config.ts`: configuração oficial da suíte E2E (Chromium, baseURL, retries em CI, relatórios HTML/GitHub, `webServer` auto para `bun run dev`).
- `tests/` organizada por módulo: `auth/`, `dashboard/`, `products/`, `categories/`, `suppliers/`, `purchases/`, `inventory/`, `customers/`, `sales/`, `finance/`, `bella-pay/`, `agenda/`, `reports/`.
- `tests/support/`:
  - `fixtures.ts` — fixture `authedPage` com auto-skip quando `E2E_USER_EMAIL`/`E2E_USER_PASSWORD` não configurados.
  - `helpers/auth.ts`, `helpers/nav.ts` — helpers de login/logout, navegação e espera.
  - `factories.ts` — factories para Produto, Categoria, Fornecedor, Cliente, Agendamento, Cobrança.
- `tests/README.md` — instruções de execução e convenções.
- Scripts em `package.json`: `test:e2e`, `test:e2e:headed`, `test:e2e:ui`, `test:e2e:install`.
- `.github/workflows/e2e.yml` — workflow para rodar Playwright em Pull Requests e `push` em `main`, com upload do relatório como artifact.
- `.gitignore`: exclusão de `test-results/`, `playwright-report/`, `playwright/.cache/`.

### QA
- Build: OK.
- TypeScript: sem erros.
- Sem alterações de código de aplicação, regras de negócio, banco ou arquitetura.
- Cobertura estimada: **smoke E2E em 100% dos módulos ativos** (13/13). Aprofundamento de asserts fica para Sprint 18.1.

---

## [0.22.1] — Sprint 16.5 — Padronização Global da Interface

### Adicionado
- `src/components/layout/page-header.tsx`: cabeçalho de página padronizado (título, descrição, ações) com tipografia consistente e layout responsivo (grid → flex).
- `src/components/layout/empty-state.tsx`: estado vazio padronizado (ícone, título, descrição, ação) para reuso em todos os módulos.
- Anel de foco global (`:focus-visible`) padronizado sobre o token `--color-ring`, com `outline-offset` consistente.
- Suporte a `prefers-reduced-motion` em `src/styles.css` (acessibilidade).

### Alterado
- `AppLayout`: padding vertical do `<main>` alinhado ao grid de 8px (`py-8`) e documentado como container global.
- Overlays de `Dialog`, `AlertDialog`, `Sheet` e `Drawer`: substituído `bg-black/80` (hardcoded) por `bg-foreground/40 backdrop-blur-sm` — respeita Light/Dark e usa exclusivamente tokens do Design System.

### QA
- Build: OK.
- TypeScript: sem erros.
- Sem regressões funcionais: banco de dados, rotas, autenticação, integrações e arquitetura preservados.
- Sem novas funcionalidades — apenas padronização visual.

---

## [0.22.0] — Sprint 17 — Tema Escuro


### Adicionado
- Suporte completo a temas **Light / Dark / System** com persistência em `localStorage` (`nexos-theme`).
- `ThemeProvider` atualizado: acompanha `prefers-color-scheme` automaticamente no modo Sistema.
- Componente reutilizável `ThemeToggle` (`src/components/theme-toggle.tsx`).
- Botão de troca de tema no Topbar, à esquerda do sino e do avatar.
- Script anti-flicker injetado no `<head>` do shell para aplicar o tema antes da hidratação.
- `color-scheme` definido no `<html>` para respeitar controles nativos (scrollbar, inputs).

### Corrigido
- Default do provider ajustado para `system`.

### Preservado
- Design System, tokens, componentes shadcn, RLS, rotas, autenticação e lógica dos módulos.

---

## [0.21.0] — Sprint 16 — RBAC (Role Based Access Control)

### Banco
- Novas tabelas: `roles`, `permissions`, `role_permissions`, `user_roles` (com RLS habilitada).
- Função `has_permission(user_id, company_id, permission_code)` — `SECURITY DEFINER`, retorna `true` automaticamente para `companies.owner_id` (compat retroativa).
- Seed: **9 papéis padrão** (`owner`, `admin`, `gerente`, `financeiro`, `estoque`, `vendas`, `marketing`, `atendimento`, `visualizador`) e **80 permissões** (16 módulos × 5 ações: `view`, `create`, `update`, `delete`, `export`).
- Policies `user_roles`: usuário vê seus próprios vínculos; owner da empresa gerencia todos os vínculos daquela empresa.

### Frontend
- Novo módulo `src/features/rbac/`:
  - Hook `usePermissions()` — retorna `has(code)`, `hasAny([...])`, `isOwner`, `companyId`.
  - Hook `useRole()` — retorna papéis atribuídos, `hasRole`, `hasAnyRole`.
  - Componente `<Can permission="products.create">` — renderiza condicionalmente.
  - Constantes tipadas `RBAC_MODULES`, `RBAC_ACTIONS`, `SYSTEM_ROLES`, `PermissionCode`.
- Sidebar agora filtra módulos pela permissão `<module>.view`. Owner continua vendo tudo.

### Compatibilidade
- **Nenhuma alteração** em RLS, Auth, triggers, storage ou lógica de módulos existentes.
- `owner_id` das empresas continua sendo o mecanismo de acesso total — nada quebra sem migração de dados.

---

## [0.20.0-rc.1] — Sprint 15 — Release Candidate 1


> Sprint de **estabilização**. Nenhuma nova funcionalidade, nenhuma mudança de regra de negócio, nenhuma alteração no Design System.

### Segurança (hardening)
- **REVOKE EXECUTE** em 7 funções `SECURITY DEFINER` internas (triggers): `apply_inventory_movement`, `bump_customer_last_interaction`, `apply_purchase_to_inventory`, `apply_sale_to_inventory`, `log_appointment_event`, `log_opportunity_event`, `update_updated_at_column`. Removido acesso direto de `anon` e `authenticated`; triggers continuam operando normalmente.
- `user_owns_company` mantida executável por design (usada dentro de políticas RLS).
- Documentadas via `COMMENT ON TABLE` as tabelas internas de webhook: `payment_events` e `bella_pay_webhook_events` (RLS ativo sem policy = deny-all para clientes; acesso apenas via `service_role` na Edge Function `bella-pay-webhook`).
- Redução do linter Supabase: **17 → 7 achados** (restantes: 2 INFO intencionais sobre webhook tables, 4 WARN sobre `user_owns_company`/`rls_auto_enable` — obrigatórios para o funcionamento; 1 WARN "Leaked Password Protection" — requer ativação manual pelo usuário no painel do Supabase Auth).

### Qualidade
- `bunx tsgo --noEmit` limpo (0 erros TypeScript).
- Arquitetura auditada: sem componentes/hooks/services duplicados nas features (`bella-ai`, `crm`, `marketing`, `agenda`, `reports`, `sales`, `finance`, `bella-pay`, `purchases`, `inventory`, `products`, `categories`, `suppliers`, `customers`).
- Sidebar, layout autenticado e Design System preservados sem regressão.

### Classificação de prontidão
🟢 **Release Candidate (RC1)** — apto a beta fechado. Bloqueadores para GA listados em ROADMAP § Pendências RC.

### Não alterado
Nenhum módulo de negócio, nenhuma tabela, nenhuma policy RLS, nenhum componente compartilhado, nenhum fluxo de UX.

---

## [0.19.0] — Sprint 14 — Bella IA Core

### Adicionado
- **Módulo Bella IA (Core)**: infraestrutura da camada de inteligência do NexOS. Sem integração real com provedores nesta sprint.
- Novas tabelas: `assistant_conversations`, `assistant_messages`, `assistant_context`, `assistant_recommendations`, `assistant_alerts` (todas com RLS por empresa e trigger `updated_at`).
- Feature `src/features/bella-ai` com `types`, `providers`, `services` e `hooks`.
- **Providers preparados** (stubs `ProviderNotImplementedError`): OpenAI, Anthropic, Google Gemini, DeepSeek — expostos por uma interface comum `AIProviderAdapter`.
- **Services**: `insights.service`, `recommendations.service`, `alerts.service`, `assistant.service`, `context.service`.
- **Tipos de alerta preparados**: estoque baixo, cliente inativo, fluxo negativo, venda acima da média, compra fora do padrão, pagamento vencido, agendamento importante, personalizado.
- **Categorias de insights**: financeiro, vendas, clientes, produtos, marketing, agenda.
- **Fontes de contexto preparadas**: produtos, compras, estoque, clientes, CRM, vendas, financeiro, agenda, marketing, relatórios, global.
- Nova rota `/bella` com dashboard premium: KPIs (Insights, Alertas, Recomendações, Tarefas sugeridas), Centro da Bella (Conversas, Insights, Alertas, Histórico — em preparação), Provedores e Fontes de Contexto.
- Sidebar: novo item **Bella IA** com ícone `Sparkles`.

### Não alterado
Produtos, Categorias, Fornecedores, Clientes, CRM, Compras, Estoque, Vendas, Financeiro, Bella Pay, Agenda, Marketing, Relatórios, autenticação, Design System e componentes compartilhados.

---

## [0.18.0] — Sprint 13 — Marketing + CRM Avançado

### Adicionado
- **CRM Avançado**: novas tabelas `pipeline_stages`, `opportunities` e `crm_events` (com timeline automática via triggers de ciclo de vida).
- Funil configurável com etapas padrão: Lead, Contato, Proposta, Negociação, Fechado, Perdido.
- Oportunidades com origem do lead, valor estimado, probabilidade, próxima ação, responsável, data prevista e motivos de ganho/perda.
- Kanban de oportunidades com drag & drop (`@dnd-kit`) e movimentação entre etapas.
- Nova rota autenticada `/crm` com métricas (pipeline, valor ponderado, conversão), Kanban e timeline recente.
- **Marketing**: nova tabela `marketing_campaigns` com canais WhatsApp / E-mail / Instagram / Facebook / Google / Outro e status (rascunho, agendada, ativa, pausada, concluída, cancelada).
- Dashboard de Marketing com cards: Leads, Conversão, Campanhas, Receita gerada.
- Segmentação de clientes por cidade, estado, segmento, compra recente (X dias), nunca comprou, ticket médio mínimo e total gasto mínimo (agregados a partir de `sales`).
- Timeline unificada em `crm_events` registra criação de campanhas, mudanças no funil, ganho/perda de oportunidades e observações.
- Item **CRM & Funil** e ativação de **Marketing** no sidebar.

### Preparado (sem integração ativa)
- Estrutura relacional pronta para Bella IA, Agenda e Relatórios via `crm_events` (`customer_id`, `opportunity_id`, `campaign_id`).
- Campanhas apenas registradas — sem envio real por APIs externas (WhatsApp/Meta/Google).

### Não alterado
- Produtos, Compras, Estoque, Clientes (CRUD existente), Vendas, Financeiro, Bella Pay, Agenda, Relatórios, autenticação e Design System.



## [0.17.0] — Sprint 12 — Agenda Inteligente (Prioridade + Integrações)

### Adicionado
- Campo **priority** em `appointments` (`baixa | media | alta | urgente`) com badge no detalhe e seletor no formulário.
- Integrações opcionais no agendamento: `sale_id`, `financial_transaction_id`, `bella_pay_charge_id` (FKs com `ON DELETE SET NULL`).
- Tabela `appointment_reminders` (estrutura para lembretes 24h/1h/no horário; sem envio real) com RLS por empresa.
- Chips de Integrações no `AppointmentDetailSheet` (Venda / Financeiro / Bella Pay).
- Filtro por prioridade em `agendaService.listRange`.

### Preparado (sem implementação)
- Notificações reais (in-app / e-mail / WhatsApp).
- Sincronização Google Calendar e Outlook.

### Não alterado
- Produtos, Compras, Estoque, Clientes, Vendas, Financeiro, Bella Pay, Relatórios, Auth, Design System.

---

## [0.16.0] — Sprint 11 — Relatórios Gerenciais

### Adicionado
- Módulo `src/features/reports/` com service único (`reports.service.ts`), hooks React Query (staleTime 60s) e componentes.
- Rota `/relatorios` com **Dashboard Executivo** (Receita, Lucro Bruto, Vendas, Produtos Vendidos, Clientes Ativos, Valor do Estoque, A Receber, A Pagar) e 6 abas de relatórios: Vendas, Financeiro, Estoque, Compras, Produtos, Clientes.
- Filtro de período com presets (Hoje, Ontem, Esta semana, Este mês, Últimos 30 dias, Personalizado) via `DateRangePicker`.
- Gráficos com Recharts: linha, barras, área e pizza. Séries diárias, top listas e agregações por categoria/status/pagamento.
- Indicadores: ticket médio, receita diária/mensal, mais/menos vendidos, sem movimentação, novos/recorrentes/inativos, giro, estoque mínimo, fluxo de caixa acumulado.
- Exportação de todos os relatórios em **PDF** (jsPDF + autoTable), **Excel** (xlsx) e **CSV** (papaparse) via `ExportButtons`.
- Sidebar: módulo Relatórios marcado como pronto.

### Observações
- Nenhum módulo existente foi alterado (Produtos, Compras, Estoque, Clientes, Vendas, Financeiro, Bella Pay, Auth, Design System permanecem intactos).
- Todas as consultas usam apenas dados já existentes; sem novas migrations.

---

## [0.15.2] — Sprint 10.2 — Bella Pay → Financeiro (Processamento Automático)

### Adicionado
- `payment_events` ganha cross-refs: `company_id`, `bella_pay_charge_id`, `sale_id`, `customer_id`, `financial_transaction_id` (índices por empresa, cobrança, venda, cliente e payment_id) — habilita timeline unificada Venda ↔ Cliente ↔ Financeiro.
- Edge Function `bella-pay-webhook` agora processa eventos ponta a ponta:
  - `PAYMENT_CREATED` → sincroniza status da cobrança.
  - `PAYMENT_CONFIRMED` → marca `CONFIRMED` sem liquidar Financeiro.
  - `PAYMENT_RECEIVED` → marca `RECEIVED`, grava `paid_at` e cria `financial_transactions` (income/paid) uma única vez, linkando de volta em `bella_pay_charges.financial_transaction_id`.
  - `PAYMENT_OVERDUE` → status `OVERDUE`.
  - `PAYMENT_DELETED` / `PAYMENT_REFUNDED` → cancela cobrança e grava `canceled_at`.
- Dashboards Financeiro (Saldo, Recebimentos, Fluxo de Caixa) e Vendas (Faturamento, Ticket Médio, Receita do Dia) refletem automaticamente as novas transações via `financial_transactions.source = 'bella_pay'`.

### Segurança
- Cobrança é sempre resolvida pela base local (`asaas_id`) antes de qualquer mutação — payload nunca é fonte de verdade para `company_id`, `sale_id` ou `customer_id`.
- Idempotência dupla: `(provider, event_id)` em `payment_events` + guarda de `financial_transaction_id` na cobrança impedem lançamentos financeiros duplicados.
- Logs sem API keys, tokens ou dados sensíveis.

### Preservado
- Produtos, Compras, Estoque, Clientes, Vendas, Financeiro, Dashboard, Agenda, Auth, Design System e componentes compartilhados — intactos.
- Rota TanStack `/api/public/bella-pay/webhook/$token` não foi alterada.

---



## [0.15.1] — Sprint 10.1 — Auditoria e Idempotência Bella Pay

### Adicionado
- Tabela `payment_events` (provider, event_id, event_type, payment_id, external_id, payload, processed, processed_at, error_message) com índice único `(provider, event_id)` para garantir idempotência entre provedores de pagamento.
- Edge Function `bella-pay-webhook` agora registra cada evento em `payment_events` antes de processar; eventos duplicados são respondidos com HTTP 200 sem reprocessamento.
- Marca `processed=true` + `processed_at` após sucesso; persiste `error_message` em falhas.
- Logs estruturados incluem `requestId`, `provider`, `eventType`, `paymentId` e `durationMs`.

### Segurança
- Nenhuma API key, token ou header sensível é registrado nos logs.
- Tabela `payment_events` acessível apenas ao `service_role` (RLS habilitada, sem policies públicas).

### Preservado
- Nenhum módulo de negócio (Produtos, Compras, Estoque, Clientes, Vendas, Financeiro, Dashboard, Agenda, Auth) foi alterado.

---



## [0.15.0] — Bella Pay — Infra Webhook (Asaas)

### Adicionado
- Supabase Edge Function `bella-pay-webhook` recebendo eventos `PAYMENT_CREATED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE` e `PAYMENT_DELETED`.
- Validação de autenticidade via header `asaas-access-token` comparado ao secret `ASAAS_WEBHOOK_TOKEN`.
- Cliente reutilizável `AsaasClient` (`supabase/functions/bella-pay-webhook/asaas-client.ts`) para chamadas à API do Asaas (sandbox/produção) baseado em `ASAAS_API_KEY` e `ASAAS_ENV`.
- Logs estruturados (JSON) por evento para facilitar depuração no painel do Supabase.

### Segurança
- Nenhuma API key persistida em arquivos — todas lidas via `Deno.env.get`.
- Payload processado apenas após validação do token.

### Preparado (sem executar nesta Sprint)
- Atualização automática do módulo Financeiro a partir dos eventos confirmados.

---

## [0.14.0] — Sprint 11 — Agenda Inteligente


### Adicionado
- Tabelas `appointments` e `appointment_events` com RLS por dono da empresa e trigger de timeline automática (criação, alteração, mudança de status, cancelamento, conclusão).
- Feature `src/features/agenda/` (types, service, hooks, componentes).
- Rota `/agenda` com Dashboard de agendamentos: **Hoje**, **Próximos 7 dias**, **Atrasados**, **Concluídos no mês**.
- Calendário premium com visualizações **Dia**, **Semana** e **Mês**, navegação rápida (anterior / hoje / próximo) e slot-click para criação.
- Cadastro de agendamento em diálogo: título, tipo (Atendimento, Entrega, Visita, Reunião, Ligação, Outro), data, hora inicial/final, cliente, responsável, local, observações e status (Agendado, Confirmado, Em andamento, Concluído, Cancelado).
- Painel lateral de detalhes com troca rápida de status, edição, exclusão e timeline unificada.
- Vínculo com **Clientes** e preparação para vínculo com **Vendas** e Encomendas.
- Sidebar: módulo **Agenda** habilitado.

### Preparado (sem executar nesta Sprint)
- Drag & drop no calendário.
- Integração com Google Calendar.
- Notificações e lembretes automáticos.

---

## [0.12.0] — Sprint 9 — Financeiro (Core)

### Adicionado
- Tabelas `financial_accounts`, `financial_categories`, `cost_centers` e `financial_transactions` com RLS por dono da empresa e índices por conta, categoria, status, data e vencimento.
- Feature `src/features/finance/` (types, service, hooks, componentes).
- Rota `/financeiro` com abas: **Visão geral**, **Movimentações**, **Contas**, **Categorias**.
- Dashboard financeiro: **Saldo atual**, **Contas a receber**, **Contas a pagar**, **Fluxo previsto**.
- Fluxo de caixa: próximas entradas, próximas saídas e resumo do mês (entradas, saídas, resultado).
- Movimentações: **Receita**, **Despesa** e **Transferência** entre contas com conta, categoria, centro de custo, valor, data, vencimento, status, origem, referência e observações.
- Contas: **Bancária**, **Caixa** e **Carteira digital** com saldo inicial, banco, agência, número e status.
- Categorias financeiras: hierárquicas por tipo (**Receita** / **Despesa**), cor e ícone.
- Filtros rápidos: busca, tipo, status, conta e categoria.
- Sidebar: módulo **Financeiro** habilitado.

### Preparado (sem executar nesta Sprint)
- Relacionamento com **Vendas**, **Compras** e **Bella Pay** via `source` + `reference_id` + `reference_number` na tabela de movimentações.

### Não implementado (adiado)
- Geração automática de cobranças a partir de Vendas.
- Integração com **Asaas** e **Bella Pay**.
- Conciliação bancária.
- Baixa automática de saldo de conta ao pagar movimentação.

---

## [0.11.0] — Sprint 8 — Vendas (MVP / PDV)

### Adicionado
- Tabelas `sales` e `sale_items` com RLS por dono da empresa e índices para número, status, cliente e data.
- Feature `src/features/sales/` (types, service, hooks, componentes).
- Rotas `/vendas`, `/vendas/novo`, `/vendas/:id`, `/vendas/:id/editar`.
- Dashboard: **Vendas do dia**, **Vendas do mês**, **Ticket médio**, **Total faturado**.
- Formulário rápido de PDV: cliente opcional, busca de produto por nome/SKU (mostra estoque e preço), quantidade, desconto por item, desconto geral, frete, observações e cálculo automático de subtotal / descontos / total.
- Formas de pagamento: **PIX, Dinheiro, Cartão** e **Bella Pay** (placeholder desabilitado).
- Ações rápidas na listagem: marcar como pendente, paga, cancelada e excluir.
- Página de detalhes com abas Dados, Itens, Cliente e Histórico (timeline) + link para a ficha no CRM.
- Sidebar: módulo **Vendas** habilitado.

### Integração
- **Vendas → Estoque**: trigger `apply_sale_to_inventory` gera movimentação **de saída** para cada item vinculado a produto quando a venda muda para **Paga**, atualiza o saldo e marca `stock_applied=true`. Idempotente.
- Estrutura preparada para **Financeiro** (`finance_ref`) e **Bella Pay** (`bella_pay_ref` + método `bella_pay`), sem gerar recebimentos nesta Sprint.

### Não implementado (adiado)
- Recebimentos financeiros automáticos, conciliação bancária.
- Integração com Asaas / Bella Pay real.
- Devoluções, cupom fiscal, impressão de comprovante.

---

## [0.10.0] — Sprint 7A — CRM (Base)

### Consolidado
- Módulo Clientes reorganizado como **base do CRM**, pronto para receber Vendas, Financeiro, Marketing, Bella Pay e Bella IA.
- Página de detalhes com **4 abas oficiais**: Dados, Timeline, Compras (placeholder), Financeiro (placeholder).
- Timeline unifica registro (Ligação, WhatsApp, E-mail, Visita, Observação) + histórico cronológico.

### Alterado
- Dashboard do CRM: card **Inativos (>90 dias)** substituído por **Sem compras** (placeholder aguardando módulo Vendas).

### Não implementado (adiado)
- Métricas reais de compras/financeiro por cliente (dependem de Vendas e Financeiro).
- Automações de segmentação, marketing e Bella IA.

---

## [0.9.0] — Sprint 8 — Estoque Integrado

### Adicionado
- Novo tipo de movimentação **Reserva** (não altera saldo físico).
- Colunas `source`, `reference_id`, `reference_number` em `inventory_movements` com índices para lookup por referência e por empresa+data.
- Enum de origem: manual, compra, venda, ajuste, devolução, sistema.
- Dashboard: novo card **Movimentações do dia** (substitui "Sem movimento 90d", que continua exibido nos alertas).
- Filtro por **Origem** na listagem e coluna **Origem/Referência** na tabela.
- Formulário de movimentação com campos Origem e Referência.

### Integração
- **Compras → Estoque**: trigger `apply_purchase_to_inventory` gera automaticamente movimentações de entrada para cada item ao mudar status para **Recebida**, atualiza o saldo e marca `stock_applied=true`. Idempotente (não reprocessa).

### Alterado
- Trigger `apply_inventory_movement` atualizado para ignorar tipos `reservation` e `transfer` no cálculo de saldo.

### Não implementado (adiado)
- Devoluções, transferências entre depósitos, múltiplos estoques, inventário físico.

---

## [0.8.0] — Sprint 7 — Compras

### Adicionado
- Tabelas `purchases` e `purchase_items` com RLS por dono da empresa e índices para número, status, fornecedor e data.
- Feature `src/features/purchases/` (services, hooks, types e componentes).
- Rotas `/compras`, `/compras/novo`, `/compras/:id`, `/compras/:id/editar`.
- Métricas: compras do mês, valor total comprado, pedidos pendentes, fornecedores ativos.
- Cadastro completo com editor de itens (busca de produto por nome/SKU), custos adicionais (desconto, frete, seguro, outros) e cálculo automático de totais.
- Página de detalhes com abas: Itens, Dados, Custos, Histórico (timeline).
- Ações rápidas na listagem: marcar como pendente, recebida, cancelada e excluir.
- Sidebar: módulo Compras ativado.

### Preparado para integração futura
- Estoque (campo `stock_applied` reservado — atualização automática entra em Sprint futura).
- Financeiro (contas a pagar geradas a partir da compra).

---

## [0.7.0] — Sprint 6 — Clientes (CRM)

### Adicionado
- Tabelas `customers` e `customer_interactions` com RLS por empresa e trigger `bump_customer_last_interaction`.
- Feature `src/features/customers/` (services, hooks, types, componentes).
- Rotas `/clientes`, `/clientes/novo`, `/clientes/:id`, `/clientes/:id/editar`.
- Métricas de CRM (total, ativos, novos no mês, inativos 90 dias).
- Timeline de interações (ligação, WhatsApp, e-mail, visita, observação).
- Abas de detalhe: Dados, Histórico, Compras (placeholder), Financeiro (placeholder), Interações, Oportunidades.

### Preparado para integração futura
- Vendas, Financeiro, Marketing, Bella Pay, Bella IA.

---

## [0.6.0] — Sprint 5 — Fornecedores

### Adicionado
- Expansão da tabela `product_suppliers` (razão social, CNPJ/CPF, IE, contato, endereço, condição de pagamento, prazo, status).
- Feature `src/features/suppliers/` com services, hooks e componentes.
- Rotas `/fornecedores`, `/fornecedores/novo`, `/fornecedores/:id`, `/fornecedores/:id/editar`.
- Abas de detalhe: Dados, Produtos vinculados, Compras (placeholder), Anotações.

---

## [0.5.1] — Correção

### Corrigido
- Erro `NotFoundError: Failed to execute 'insertBefore' on 'Node'` após salvar produto — causado por tradução automática do Chrome. Ajustado `lang="pt-BR"` em `src/routes/__root.tsx`.
- Erro `NotFoundError: Failed to execute 'removeChild' on 'Node'` no Select de segmento (onboarding) — `translate="no"` aplicado em `src/components/ui/select.tsx`.

---

## [0.5.0] — Sprint 4 — Estoque

### Adicionado
- Tabela `inventory_movements` com trigger `apply_inventory_movement` para sincronizar estoque.
- Feature `src/features/inventory/` com dashboard, movimentações, histórico por produto e alertas.
- Rotas `/estoque` e `/estoque/produto/:productId`.
- Suporte a Entrada, Saída, Ajuste (Transferência preparada).

---

## [0.4.0] — Sprint 3 — Categorias

### Adicionado
- Expansão de `product_categories` (descrição, cor, ícone, status, `parent_id`).
- Feature `src/features/categories/` com listagem em árvore, criação/edição em diálogo, arquivar/restaurar.
- Rota `/categorias` com métricas e abas por status.

---

## [0.3.0] — Sprint 2 — Produtos

### Adicionado
- Tabelas `product_categories`, `product_suppliers`, `products`, `product_images` com RLS.
- Bucket privado `product-images` (Supabase Storage).
- Feature `src/features/products/` com formulário em abas, uploader de imagens, calculadora de preço sugerido.
- Rotas `/produtos`, `/produtos/novo`, `/produtos/:id`, `/produtos/:id/editar`.
- Métricas: total, ativos, estoque crítico, valor em estoque.

---

## [0.2.0] — Sprint 1 — Autenticação, Onboarding e Dashboard

### Adicionado
- Tabelas `profiles` e `companies` com RLS e triggers.
- Supabase Auth (login, cadastro, recuperação de senha).
- Feature `src/features/onboarding/` (cadastro obrigatório da empresa).
- Feature `src/features/dashboard/` (Greeting, KPI, Próxima Ação, Alertas, Insights, Ações Rápidas).
- Guard de rota autenticada em `src/routes/_authenticated/`.
- Sidebar com os 12 módulos principais e Topbar com perfil do usuário.

---

## [0.1.0] — Sprint 0 — Fundação

### Adicionado
- Design System em `src/styles.css` (paleta oficial, Inter + JetBrains Mono, raio 10px).
- Estrutura modular `src/features/` com dependência unidirecional.
- Providers globais (`QueryClientProvider`, `ThemeProvider`, `AuthProvider`, `Toaster`).
- Serviços base (`supabase.service.ts`, `storage.service.ts`).
- Utilidades (`cn`, `format`, hooks compartilhados).
- Documentação inicial (`ARCHITECTURE.md`).

---

## Formato para novas entradas

```
## [X.Y.Z] — Sprint N — <Nome>
Data: AAAA-MM-DD

### Adicionado
- ...

### Alterado
- ...

### Corrigido
- ...

### Removido
- ...

### Segurança
- ...
```

Cada release deve referenciar a sprint do `ROADMAP.md` e ser aprovada pelo QA antes da publicação.
