# NEXOS MASTER ROADMAP

## 1. Visão Geral do Projeto
O NexOS é um ecossistema ERP focado em varejo e e-commerce, com integração nativa a Marketplaces (Mercado Livre), WhatsApp Cloud API e assistência inteligente via Bella IA. O projeto utiliza TanStack Start, React 19, Tailwind CSS v4 e Supabase.

---

## 2. Status dos Módulos

### Dashboard
- **Concluídas:** KPIs em tempo real, Gráficos de tendência, Alertas críticos, Bella Executive Strip.
- **Parciais:** Visão Multi-Empresa, Previsão de Demanda.
- **Pendentes:** Customização de Widgets (Drag-and-Drop).
- **Percentual Estimado:** 85%
- **Última Homologação:** 04/08/2026

### PDV (Ponto de Venda)
- **Concluídas:** Venda direta, Pagamento múltiplo, Modo Offline, Impressão ESC/POS, Descontos, Fluxo de Pagamento Pendente, Suporte a Scanner USB.
- **Parciais:** Integração com Balança.
- **Pendentes:** Devolução/Troca direta no PDV.
- **Percentual Estimado:** 92%
- **Última Homologação:** 04/08/2026

### Produtos
- **Concluídas:** Cadastro multi-canal, Motor Comercial V2, NCM/GTIN Master, Dimensões Logísticas, Fotos (Storage).
- **Parciais:** Grade de Variações Complexa.
- **Pendentes:** Kit de Produtos (Interface de montagem).
- **Percentual Estimado:** 95%
- **Última Homologação:** 04/08/2026

### Compras
- **Concluídas:** Entrada via XML, Rateio Proporcional de custos, Atualização de custo efetivo.
- **Parciais:** Cotação com múltiplos fornecedores.
- **Pendentes:** Sugestão de compra via IA (UI).
- **Percentual Estimado:** 80%
- **Última Homologação:** 01/08/2026

### Estoque
- **Concluídas:** Movimentação rastreável, Reserva de estoque (Marketplace), Inventário rotativo.
- **Parciais:** Gestão de Múltiplos Depósitos.
- **Pendentes:** Transferência entre filiais automatizada.
- **Percentual Estimado:** 88%
- **Última Homologação:** 01/08/2026

### Financeiro
- **Concluídas:** Contas a Receber, Contas a Pagar, Fluxo de Caixa, Automação de Recebíveis (PDV).
- **Parciais:** Conciliação bancária via OFX.
- **Pendentes:** Emissão de Boletos (Asaas Full Integration).
- **Percentual Estimado:** 85%
- **Última Homologação:** 02/08/2026

### Clientes
- **Concluídas:** Cadastro, Histórico de compras, Limite de Crediário, Lista de Interesse (OOS).
- **Parciais:** Segmentação RFM automática.
- **Pendentes:** Programa de Fidelidade (Pontuação).
- **Percentual Estimado:** 90%
- **Última Homologação:** 03/08/2026

### Fornecedores
- **Concluídas:** Cadastro básico, Histórico de compras por fornecedor.
- **Parciais:** Avaliação de performance de fornecedor.
- **Pendentes:** Portal do Fornecedor.
- **Percentual Estimado:** 75%
- **Última Homologação:** 01/08/2026

### Fiscal
- **Concluídas:** Infraestrutura NCM, Emissão de NFC-e (Modelo 65), Refatoração nfe-engine (Lock exclusivo).
- **Parciais:** NF-e (Modelo 55) - Emissão em massa.
- **Pendentes:** Manifestação de Destinatário.
- **Percentual Estimado:** 82%
- **Última Homologação:** 04/08/2026

### Mercado Livre
- **Concluídas:** Publicação (POST /items), Sincronização (PUT /items), Persistência de ml_item_id, Proteção contra loop de estoque, OAuth renovável.
- **Parciais:** Sincronização de anúncios com variações.
- **Pendentes:** Gestão de Reclamações e Mensagens pós-venda.
- **Percentual Estimado:** 88%
- **Última Homologação:** 04/08/2026

### Shopee
- **Concluídas:** Nenhuma.
- **Parciais:** Infraestrutura básica de Marketplace (shared logic).
- **Pendentes:** Integração completa (API).
- **Percentual Estimado:** 5%
- **Última Homologação:** N/A

### Bella IA
- **Concluídas:** Navegação categórica no WhatsApp, Persistência de estado (bella_state), Janela de 24h (Smart Sending), Auditoria Fiscal/Financeira, Advisor.
- **Parciais:** Voz para Texto (Speech-to-Text).
- **Pendentes:** Execução autônoma de tarefas complexas (Agents).
- **Percentual Estimado:** 90%
- **Última Homologação:** 04/08/2026

### Relatórios
- **Concluídas:** Vendas, Estoque, Financeiro, Auditoria Forense.
- **Parciais:** Customização de colunas.
- **Pendentes:** Exportação para PDF/Excel customizada.
- **Percentual Estimado:** 85%
- **Última Homologação:** 04/08/2026

### Integrações
- **Concluídas:** Mercado Livre, WhatsApp Cloud API, Asaas (Básico).
- **Parciais:** Google Search Console.
- **Pendentes:** Shopee, Tiny/Bling (Migration tool).
- **Percentual Estimado:** 70%
- **Última Homologação:** 04/08/2026

---

## 3. Próximas Sprints
- **Sprint 8.2:** Homologação NF-e (Modelo 55) em massa e Manifesto.
- **Sprint 8.3:** Refinamento da Grade de Variações e Kits de Produtos.
- **Sprint 9.0:** Início da Integração Nativa Shopee.

---

## 4. Backlog de Ideias
- Aplicativo Mobile Nativo para Inventário.
- Totem de Autoatendimento.
- Inteligência preditiva para evitar "Ruptura de Estoque".

---

## 5. Bugs Conhecidos
- **P0:** Redirecionamento SSR em Preview ocasionalmente gera 502 (Mitigado via LOVABLE_PREVIEW_HOST).
- **P1:** Delay de 200ms na atualização do cache de busca do PDV em catálogos > 10k itens.
- **P2:** Formatação de CEP em endereços internacionais.

---

## 6. Histórico de Homologações
- **04/08/2026:** Homologação Forense (RC.1.3) - Todos os módulos core validados.
- **03/08/2026:** Sprint 8.1 - Multi-tenant e Lista de Interesse.
- **01/08/2026:** Sprint 7.4 - Hardening e Design System.
