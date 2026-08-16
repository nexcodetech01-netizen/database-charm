# Plano de Notificações Enterprise PDV e Catálogo

Implementar notificações de navegador (Notification API) para novos pedidos do catálogo e sincronização de estado em tempo real entre abas usando BroadcastChannel.

## Alterações

### Frontend - Infraestrutura de Sincronização
- Criar `src/features/whatsapp/lib/inbox-sync.ts` para gerenciar a comunicação entre abas via `BroadcastChannel`.
- Exportar uma instância global de `BroadcastChannel` chamada `inbox-channel`.

### Frontend - Hooks e Integração
- Criar `src/features/whatsapp/hooks/use-inbox-notifications.ts` para encapsular a lógica de permissão de notificações e exibição de alertas nativos do navegador.
- Integrar o `BroadcastChannel` no `useCommercialInboxRealtime` para propagar eventos de novos pedidos entre abas sem depender apenas do listener individual do Supabase.
- Atualizar a `Topbar` para escutar o `BroadcastChannel` e sincronizar o contador visual instantaneamente quando um pedido for lido/atendido em outra aba.

### Frontend - Componentes UI
- Modificar `src/components/layout/topbar.tsx`:
    - Adicionar suporte à Notification API (solicitar permissão ao usuário).
    - Refatorar a lógica de exibição para respeitar a preferência de som.
    - Implementar a sincronização do `catalogOrdersCount` via BroadcastChannel.
    - Adicionar um botão/toggle para permitir notificações do navegador.

## Detalhes Técnicos
- **Notification API**: Verificação de `Notification.permission`.
- **BroadcastChannel**: Canal `nexos:inbox-sync` para mensagens do tipo `NEW_ORDER` e `ORDER_RESOLVED`.
- **Idempotência**: Uso do ID do ticket/evento para garantir que a mesma notificação não dispare duas vezes na mesma aba.
- **Resiliência**: Fallback silencioso em navegadores que não suportam BroadcastChannel ou Notifications.
