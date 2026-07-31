# NexOS — Módulos

> Registro oficial dos módulos do sistema. Complementa o `BLUEPRINT.md` (§5).
>
> **Status**: 🟢 pronto · 🟡 em andamento · ⚪ planejado.

---

## 1. Dashboard  🟢

- **Objetivo**: visão executiva com saudação, KPIs, próxima ação, alertas, insights e ações rápidas.
- **Rota**: `/dashboard`.
- **Dependências**: dados agregados dos demais módulos.
- **Integrações futuras**: Bella IA (insights), todos os módulos (KPIs reais).

---

## 2. Bella IA  🟡

- **Objetivo**: copiloto transversal — sugestões, resumos, ações rápidas por contexto.
- **Rota**: `/bella` (dashboard) + inline em cada módulo (futuro).
- **Dependências**: todos os módulos como fonte de contexto; provedores de LLM (OpenAI, Anthropic, Gemini, DeepSeek).
- **Sprint 14 (Core)**: tabelas `assistant_conversations`, `assistant_messages`, `assistant_context`, `assistant_recommendations`, `assistant_alerts`. Feature `bella-ai` com providers stub, services (`insights`, `recommendations`, `alerts`, `assistant`, `context`) e dashboard premium com KPIs, Centro da Bella, Provedores e Fontes de Contexto.
- **Tipos de alerta preparados**: `low_stock`, `inactive_customer`, `negative_cashflow`, `sale_above_average`, `purchase_out_of_pattern`, `overdue_payment`, `important_appointment`, `custom`.
- **Categorias de insights**: financeiro, vendas, clientes, produtos, marketing, agenda.
- **Próximas sprints**: integração real com provedores, chat conversacional, geração automática de alertas/recomendações, execução de ações.

---

## 3. Produtos  🟢

- **Objetivo**: CRUD com precificação, imagens, estoque inicial, tags e status.
- **Rota**: `/produtos`.
- **Dependências**: Categorias, Fornecedores, Storage (`product-images`).
- **Integrações futuras**: Vendas, Compras, Estoque, Marketing, Bella IA.

---

## 4. Categorias  🟢

- **Objetivo**: taxonomia hierárquica (pai/subcategorias) com cor, ícone, status.
- **Rota**: `/categorias`.
- **Dependências**: Produtos.
- **Integrações futuras**: Relatórios, Marketing, Bella IA.

---

## 5. Estoque  🟢

- **Objetivo**: movimentações (entrada, saída, ajuste, reserva) com origem/referência, histórico, alertas de mínimo e estagnação, integração automática com Compras.
- **Rota**: `/estoque`, `/estoque/produto/:productId`.
- **Dependências**: Produtos, Compras.
- **Integrações ativas**: Compras (entrada automática ao receber pedido).
- **Integrações futuras**: Vendas (baixa automática), Financeiro (custo), Bella IA (previsão), transferências entre depósitos, inventário.

---

## 6. Compras  🟢

- **Objetivo**: ordens de compra com itens, custos adicionais, status (Rascunho, Pendente, Recebida, Cancelada) e histórico.
- **Rota**: `/compras`, `/compras/novo`, `/compras/:id`, `/compras/:id/editar`.
- **Dependências**: Fornecedores, Produtos.
- **Integrações futuras**: Estoque (atualização automática ao receber), Financeiro (contas a pagar), Relatórios, Bella IA (sugestão de reposição).

---

## 7. Fornecedores  🟢

- **Objetivo**: cadastro completo (fiscais, contato, endereço, condição de pagamento) + histórico.
- **Rota**: `/fornecedores`.
- **Dependências**: Produtos.
- **Integrações futuras**: Compras, Financeiro (contas a pagar), Bella IA (avaliação).

---

## 8. Clientes (CRM)  🟢

- **Objetivo**: base do CRM — cadastro completo (CPF/CNPJ, contato, endereço, tags, segmento, status), timeline unificada de interações, dashboard com métricas e detalhes com abas Dados / Timeline / Compras / Financeiro.
- **Rota**: `/clientes`, `/clientes/novo`, `/clientes/:id`, `/clientes/:id/editar`.
- **Dependências**: —.
- **Integrações futuras**: Vendas, Financeiro (contas a receber), Marketing (campanhas), Bella Pay (cobrança), Bella IA (segmentação, próxima ação).

---

## 9. Vendas  🟢

- **Objetivo**: PDV leve — registro de vendas com cliente opcional, busca rápida de produtos, desconto por item e geral, frete, formas de pagamento (PIX, Dinheiro, Cartão, Bella Pay placeholder), status (Rascunho, Pendente, Paga, Cancelada) e histórico.
- **Rota**: `/vendas`, `/vendas/novo`, `/vendas/:id`, `/vendas/:id/editar`.
- **Fluxo do formulário (Sprint 19.2)**: 5 etapas guiadas — **1. Cliente → 2. Itens → 3. Descontos e frete → 4. Pagamento → 5. Observações** — com resumo lateral fixo (subtotal, descontos, frete, total, lucro, margem, linhas + unidades).
- **Regras de UX**: itens bloqueados até seleção do cliente; produto autopreenche preço/custo/SKU/estoque/imagem; alerta por linha e agregado quando quantidade > estoque; forma de pagamento obrigatória apenas para finalizar.
- **Dependências**: Produtos, Clientes, Estoque.
- **Integrações ativas**: Estoque (saída automática ao marcar como paga).
- **Integrações futuras**: Financeiro (contas a receber), Bella Pay (cobrança real), Marketing, Relatórios, Bella IA (upsell/cross-sell).

---

## 10. Financeiro  🟢

- **Objetivo**: núcleo financeiro — saldo por conta, movimentações (receita, despesa, transferência), contas a pagar/receber, categorias hierárquicas, centros de custo e fluxo de caixa previsto.
- **Rota**: `/financeiro` (abas: Visão geral, Movimentações, Contas, Categorias).
- **Dependências**: Compras, Vendas (relacionamento preparado, sem geração automática).
- **Integrações futuras**: Bella Pay (cobrança), Asaas, conciliação bancária, baixa automática de saldo, Relatórios, Bella IA (previsão de caixa).

---

## 11. Bella Pay (Asaas)  🟡

- **Objetivo**: cobrança nativa (PIX, cartão, link) integrada ao Asaas dentro do Financeiro/Vendas.
- **Rota**: `/bella-pay` + embarcado em Vendas e Financeiro.
- **Dependências**: Financeiro, Vendas, Clientes.
- **Infra**: Edge Function `bella-pay-webhook` (Supabase) recebe eventos do Asaas usando `ASAAS_WEBHOOK_TOKEN`; API keys lidas apenas via secrets (`ASAAS_API_KEY`, `ASAAS_ENV`).
- **Idempotência**: tabela `payment_events` com índice único `(provider, event_id)`. Eventos duplicados são detectados antes do processamento e respondidos com HTTP 200 sem reprocessar. Cada execução persiste `processed`, `processed_at` e, em falhas, `error_message`. Logs estruturados incluem `requestId`, `eventType`, `paymentId` e `durationMs` — nunca API keys ou tokens.
- **Integrações futuras**: baixa automática no Financeiro a partir dos eventos `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`, conciliação, notificações.


---

## 12. Agenda  🟢

- **Objetivo**: compromissos, tarefas e lembretes com integração a Clientes, Vendas, Financeiro e Bella Pay.
- **Rota**: `/agenda`.
- **Sprint 12**: prioridade (baixa/média/alta/urgente), FKs opcionais para `sales`, `financial_transactions`, `bella_pay_charges`, tabela `appointment_reminders` (estrutura para 24h/1h/no horário).
- **Dependências**: Clientes, Vendas, Financeiro, Bella Pay.
- **Preparado (futuro)**: Google Calendar, Outlook, WhatsApp, envio real de notificações, Bella IA (sugestão de follow-up).

---

## 13. Marketing  ⚪

- **Objetivo**: campanhas simples (e-mail/WhatsApp), segmentação de clientes.
- **Rota**: `/marketing` (a criar).
- **Dependências**: Clientes, Bella IA.
- **Integrações futuras**: Vendas (atribuição), Relatórios.

---

## 14. Relatórios  🟢

- **Objetivo**: relatórios gerenciais consolidados por módulo com filtros por período e exportação.
- **Rota**: `/relatorios`.
- **Estrutura**: Dashboard Executivo + 6 abas (Vendas, Financeiro, Estoque, Compras, Produtos, Clientes).
- **Filtros**: Hoje, Ontem, Esta semana, Este mês, Últimos 30 dias, Personalizado.
- **Gráficos**: linha, barras, área e pizza (Recharts).
- **Exportação**: PDF (jsPDF), Excel (xlsx), CSV (papaparse).
- **Dependências**: Vendas, Financeiro, Estoque, Compras, Produtos, Clientes.
- **Integrações futuras**: Bella IA (análises narrativas), agendamento de envio.

---

## 15. Configurações  🟡

- **Objetivo**: dados da empresa, preferências, integrações, tema, faturamento do SaaS.
- **Sprint 17 (Tema)**: suporte a Light/Dark/System via `ThemeProvider` + `ThemeToggle` no Topbar, com persistência em `localStorage` e acompanhamento automático do SO.
- **Rota**: `/configuracoes` (a criar).
- **Dependências**: Auth, Usuários e Permissões.
- **Integrações futuras**: Bella Pay (faturamento SaaS), integrações externas.

---

## 16. Usuários e Permissões (RBAC)  🟡

- **Objetivo**: convidar usuários, atribuir papéis e controlar acesso por módulo/ação.
- **Sprint 16 (Core)**: tabelas `roles`, `permissions`, `role_permissions`, `user_roles`; função `has_permission(user, company, code)`; seed de 9 papéis padrão × 80 permissões (16 módulos × 5 ações — view/create/update/delete/export); frontend `src/features/rbac/` com `usePermissions()`, `useRole()`, `<Can>`; Sidebar filtrada por `view`.
- **Rota**: `/usuarios` (UI de gestão pendente — módulo Configurações).
- **Compat retroativa**: `companies.owner_id` = todas as permissões.
- **Pendente**: UI de convites, atribuição de papéis, editor de permissões custom.

---

## Design System & Padronização Global  🟢

- **Objetivo**: garantir consistência visual e experiência premium em toda a aplicação.
- **Tokens**: cores, tipografia, raios e sombras vivem em `src/styles.css` (`@theme inline`) — nunca usar hex hardcoded em componentes.
- **Layout global**: `AppLayout` provê container único (`px-4 py-8 sm:px-6 lg:px-8`) alinhado ao grid de 8px. Páginas usam `mx-auto max-w-7xl` (listas), `max-w-6xl` (detalhes) ou `max-w-5xl` (formulários).
- **Primitivas compartilhadas**: `Button`, `Card`, `Input`, `Select`, `Textarea`, `Badge`, `Dialog`, `AlertDialog`, `Sheet`, `Drawer`, `Table`, `Skeleton`, `Sonner` (toasts) — todas em `src/components/ui/` (shadcn) e reutilizadas em todo o produto.
- **Layout primitives** (`src/components/layout/`): `PageHeader` (com props `icon` e `meta`), `EmptyState`, `BreadcrumbNav` (auto, renderizado pelo `AppLayout`), `SectionToolbar` (busca + filtros + ações), `ListSkeleton` / `CardsSkeleton`. Usar em toda página nova. Atalhos visuais em `@/components/ui/kbd`.
- **Sprint 16.5 (Padronização)**: overlays de modais migrados para tokens (`bg-foreground/40 backdrop-blur-sm`), focus-ring global via `:focus-visible` sobre `--color-ring`, suporte a `prefers-reduced-motion`, `AppLayout` alinhado ao grid de 8px.

---

_Documento vivo — atualizar a cada mudança de status ou dependência._

