# NexOS — Roadmap

> Documento oficial de planejamento do produto. Complementa o `BLUEPRINT.md` (seção 9). Toda alteração de escopo deve refletir aqui.

---

## 1. Visão geral

O NexOS é entregue em **sprints incrementais** por módulo de negócio, respeitando o fluxo oficial (Product Owner → Tech Lead → Implementação → QA → Publicação).

Princípios do roadmap:

- **Um módulo por sprint** sempre que possível.
- **Fundação primeiro** (auth, layout, design system, dashboard) antes de qualquer módulo de negócio.
- **Dependências resolvidas antes** — nenhum módulo é iniciado sem seus pré-requisitos.
- **Nada entra em produção sem QA aprovado** e checklist de qualidade completo.

---

## 2. Sprints

### ✅ Sprint 0 — Fundação visual e arquitetura
- Design System (tokens, tipografia, paleta oficial).
- Estrutura de pastas modular por feature.
- Providers globais (QueryClient, Theme, Auth, Toaster).
- Layout autenticado, Sidebar, Topbar.

### ✅ Sprint 1 — Autenticação e Dashboard
- Supabase Auth (login, cadastro, recuperação de senha).
- Onboarding da empresa.
- Guard de rota autenticada.
- Dashboard inicial da Bella (Greeting, KPI, Próxima Ação, Alertas, Insights, Ações Rápidas).

### ✅ Sprint 2 — Produtos
- CRUD completo com abas (Informações, Precificação, Estoque, Imagens, Adicional).
- Upload de múltiplas imagens (Supabase Storage).
- Página de detalhes e listagem com métricas, filtros e paginação.

### ✅ Sprint 3 — Categorias
- Hierarquia (pai/subcategorias), cor, ícone, status.
- Contador de produtos vinculados.
- Arquivar/restaurar.

### ✅ Sprint 4 — Estoque
- Dashboard, listagem, movimentações (entrada, saída, ajuste).
- Histórico por produto, timeline, alertas de mínimo.
- Estrutura preparada para transferência.

### ✅ Sprint 5 — Fornecedores
- Cadastro completo (fiscais, contato, endereço, condição de pagamento).
- Página de detalhes com abas (Dados, Produtos, Compras placeholder, Anotações).

### ✅ Sprint 6 — Clientes (CRM)
- Cadastro completo, tags, segmento.
- Interações (ligação, WhatsApp, e-mail, visita, observação) em timeline.
- Abas: Dados, Histórico, Compras, Financeiro, Interações, Oportunidades.

### ✅ Sprint 7 — Compras
- Ordens de compra com itens, custos adicionais (desconto, frete, seguro, outros) e status (Rascunho, Pendente, Recebida, Cancelada).
- Listagem com métricas, filtros, ordenação e ações rápidas.
- Detalhes com abas (Itens, Dados, Custos, Histórico).
- Estrutura preparada para integração com Estoque e Financeiro.

### ✅ Sprint 8 — Estoque Integrado
- Novo tipo de movimentação: **Reserva** (não altera saldo).
- Campos de **origem** (manual, compra, venda, ajuste, devolução, sistema) e **referência**.
- Novo card no dashboard: **Movimentações do dia**.
- **Integração Compras → Estoque**: trigger no banco gera entrada automática ao receber compra e marca `stock_applied`.
- Alertas: abaixo do mínimo e sem movimentação há 90 dias.

### ✅ Sprint 7A — CRM (Base)
- Consolidação da base de Clientes: dashboard (Total, Ativos, Novos no mês, Sem compras placeholder), listagem, cadastro completo e detalhes com abas oficiais (Dados, Timeline, Compras placeholder, Financeiro placeholder).
- Timeline unificada de interações (Ligação, WhatsApp, E-mail, Visita, Observação).
- Banco preparado para integrações futuras com Vendas, Financeiro, Marketing, Bella Pay e Bella IA (sem automações nesta sprint).

### ✅ Sprint 8 — Vendas (MVP / PDV)
- Módulo Vendas com dashboard (vendas do dia, mês, ticket médio, total faturado), listagem, cadastro em fluxo de PDV (cliente opcional, itens com busca de produto, desconto por item, desconto geral, frete) e detalhes com abas Dados / Itens / Cliente / Histórico.
- Pagamentos: PIX, Dinheiro, Cartão e Bella Pay (placeholder).
- Integração automática **Vendas → Estoque**: saída gerada ao marcar como paga.
- Estrutura de banco preparada para Financeiro e Bella Pay (sem gerar recebimentos nesta sprint).

### ✅ Sprint 9 — Financeiro (Core)
- Módulo Financeiro com dashboard (saldo atual, contas a receber, contas a pagar, fluxo previsto), movimentações (receita, despesa, transferência), contas (bancária, caixa, carteira digital), categorias hierárquicas (receita/despesa) e fluxo de caixa (próximas entradas/saídas + resumo do mês).
- Filtros rápidos: busca, tipo, status, conta e categoria.
- Relacionamento preparado para **Vendas**, **Compras** e **Bella Pay** via `source` + `reference_id` (sem geração automática nesta sprint).
- Adiados: geração de cobranças a partir de Vendas, integração Asaas, conciliação bancária, baixa automática de saldo.

### 🟡 Sprint 10 — Configurações
- Perfil da empresa, preferências, integrações, tema, faturamento SaaS.

### ✅ Sprint 11 — Agenda + Relatórios Gerenciais
- Agenda inteligente com visualizações dia/semana/mês e relatórios executivos.

### ✅ Sprint 12 — Agenda Inteligente
- Prioridades, integrações com Vendas/Financeiro/Bella Pay, estrutura de lembretes.

### ✅ Sprint 13 — Marketing + CRM Avançado
- Funil de oportunidades com Kanban DnD, campanhas e segmentação avançada.

### ✅ Sprint 14 — Bella IA Core
- Infraestrutura da Bella IA: tabelas (`assistant_*`), providers stub (OpenAI, Anthropic, Gemini, DeepSeek), services (`insights`, `recommendations`, `alerts`, `assistant`, `context`), dashboard premium em `/bella`.
- Sem integração real com LLMs nesta sprint — apenas arquitetura.

### ✅ Sprint 15 — Release Candidate 1 (v0.20.0-rc.1)
- Sprint de **estabilização**. Nenhuma funcionalidade nova.
- Hardening de segurança: REVOKE EXECUTE em 7 funções `SECURITY DEFINER` internas de trigger. Linter Supabase: 17 → 7 achados.
- Typecheck limpo, arquitetura auditada, docs atualizados.
- **Classificação: Release Candidate** — apto a beta fechado.

### ✅ Sprint 16 — RBAC (v0.21.0)
- Tabelas `roles`, `permissions`, `role_permissions`, `user_roles` com RLS.
- Função `has_permission(user, company, code)` — owner sempre autorizado (compat retroativa).
- 9 papéis padrão × 80 permissões seed (16 módulos × 5 ações).
- Frontend: `usePermissions()`, `useRole()`, `<Can>`; Sidebar filtrada por permissão `view`.
- Zero regressão em módulos existentes.

### ✅ Sprint 17 — Tema Escuro (v0.22.0)
- ThemeProvider (Light / Dark / System) com persistência em `localStorage` e script anti-flicker.
- ThemeToggle na Topbar. Componentes revisados para consumo exclusivo de tokens em `.dark`.

### ✅ Sprint 16.5 — Padronização Global (v0.22.1)
- Grid 8px, `PageHeader`, `EmptyState`, overlays em tokens, focus ring global, `prefers-reduced-motion`.

### ✅ Sprint 18 — Testes Automatizados (v0.24.0)
- Suíte Playwright (TypeScript) organizada por módulo em `tests/`.
- Fixtures (`authedPage`), helpers e factories em `tests/support/`.
- Scripts: `bun test:e2e`, `test:e2e:headed`, `test:e2e:ui`.
- Workflow GitHub Actions (`.github/workflows/e2e.yml`) executando em PRs e `push` em `main`.
- Sem alteração de código de aplicação, banco ou arquitetura.

### ✅ Sprint 20 — UX Premium + Homologação Geral (v0.25.0-rc.2)
- `PageHeader` estendido (icon + meta slots), novo `BreadcrumbNav` global, `SectionToolbar`, `ListSkeleton`/`CardsSkeleton`, `Kbd`.
- `AppLayout` com `<main>` único, fade-in `motion-safe` e breadcrumb automático abaixo do Topbar.
- Router com `defaultPreload: "intent"` para reduzir latência percebida.
- A11y: landmark `<main>`, foco visível em navegação, `aria-hidden` em decorativos, `aria-current` no crumb ativo.
- Sem alteração de banco, RLS, Auth, integrações ou regras de negócio. Classificação: **RC2**.


### 📌 Pendências para GA (após RC1)
1. **Ativar "Leaked Password Protection"** no painel Supabase Auth (ação manual do usuário).
2. **Configurações** — perfil da empresa, integrações, preferências, tela de gestão de usuários/papéis (UI para o RBAC recém-criado).
3. **Financeiro × Vendas/Compras** — geração automática de contas a receber/pagar.
4. **Bella IA** — integração real com pelo menos um provedor (OpenAI/Gemini via Lovable AI Gateway).
5. Aprofundar asserts dos specs E2E (Sprint 18.1): validar side-effects de estoque, conciliação de webhook Bella Pay, geração de PDF em Relatórios.

---

## 3. Backlog priorizado

### Alta prioridade (próximas sprints)
1. **Usuários e Permissões** — convites, papéis (owner/admin/operator/viewer), gestão.
2. **Configurações** — perfil da empresa, integrações, preferências.
3. **Financeiro × Vendas/Compras** — geração automática de contas a receber/pagar e baixa de saldo.

### Média prioridade
5. **Bella Pay (Asaas)** — boleto, Pix, cartão, webhooks, conciliação.
6. **Bella IA** — superfícies transversais, sugestões contextuais.
7. **Agenda** — compromissos, tarefas, lembretes vinculados.
8. ~~**Relatórios** — catálogo inicial por módulo + consolidados.~~ ✅ Entregue em v0.16.0 (Sprint 11).

### Baixa prioridade / futuro
9. Marketing (campanhas e-mail/WhatsApp, segmentação).
10. Variações e kits de produtos.
11. Múltiplos locais de estoque e transferências.
12. App mobile.
13. API pública.

---

## 4. Critérios de priorização

Critérios usados pelo Product Owner para ordenar o backlog:

1. **Valor para o cliente PME** — impacto direto na operação diária.
2. **Dependência técnica** — módulos base antes de módulos derivados.
3. **Risco** — módulos com integrações externas (Asaas, IA) exigem preparação.
4. **Esforço vs entrega** — priorizar entregas incrementais com valor visível.
5. **Alinhamento com posicionamento** — reforçar diferenciais (IA, pagamentos BR).

---

## 5. Critérios de conclusão de sprint

Uma sprint só é considerada concluída quando **todos** os itens abaixo estão marcados (ver `BLUEPRINT.md` §10):

- [ ] Escopo entregue conforme aprovado pelo Product Owner.
- [ ] Build aprovado (`vite build`).
- [ ] TypeScript sem erros (`tsgo`).
- [ ] ESLint sem erros (warnings justificados).
- [ ] Console sem erros em runtime.
- [ ] Responsividade validada (mobile, tablet, desktop).
- [ ] Sem regressões nos módulos vizinhos.
- [ ] QA aprovado formalmente.
- [ ] GitHub sincronizado (branch principal).
- [ ] Documentação atualizada (`BLUEPRINT.md`, `CHANGELOG.md`, `MODULES.md`).

---

_Documento vivo — atualize a cada início/fim de sprint._
