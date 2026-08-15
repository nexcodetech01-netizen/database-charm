# Plano de Implementação: Alerta de Pedidos do Catálogo

Implementação do mecanismo de notificação ativa para novos pedidos vindos do catálogo do WhatsApp, garantindo visibilidade imediata no ERP NexOS.

## Mudanças

### Backend e Infraestrutura de Eventos
- **Evento de Domínio**: Registrar o tipo `catalog.order.received` no catálogo central de eventos da Bella IA.
- **Emissão e Idempotência**: No serviço de Inbox Comercial, disparar o evento apenas na criação de novos tickets, usando o ID do ticket para evitar alertas duplicados por reprocessamento.
- **Segurança**: Utilizar contexto de sistema para garantir que a notificação chegue a todos os usuários logados da empresa, independentemente de quem disparou o webhook.

### Frontend e User Experience
- **Notificação Visual (Toast)**: Exibir um alerta flutuante (`sonner`) em tempo real com o nome do cliente, valor do pedido e botão de atalho para o Inbox.
- **Contador Dinâmico**: Adicionar um badge de notificação no ícone do sino na barra superior, refletindo o número de pedidos pendentes.
- **Feedback Sonoro**: Implementar alerta sonoro ao receber o pedido, com controle de preferência (mudo/ativado) persistido localmente.
- **Navegação**: Link direto no menu de notificações para a tela de atendimento.

## Detalhes Técnicos
- Registro do evento em `src/features/bella-ai/events/catalog.ts` e `BellaEventTypes.ts`.
- Disparo do evento em `src/features/whatsapp/inbound/commercial-inbox.server.ts` via `emitAgentEvent`.
- Integração do `bellaEventRegistry` no componente `src/components/layout/topbar.tsx` usando hooks do React para reatividade.
- Persistência de preferências de som via `localStorage`.
- Validação via Vitest garantindo que o evento só é disparado no `created: true`.
