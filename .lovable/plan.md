# Plano de Correção: Timing de Notificações Externas

O objetivo é garantir que as notificações históricas e em tempo real (n8n) sejam processadas apenas após o carregamento das preferências de notificação, evitando que o `BellaEventRegistry` descarte eventos por falta de configuração.

## Alterações Técnicas

### 1. Hook `useExternalNotificationsRealtime`
- **Novos Parâmetros**: Receber `settings` e `settingsLoading` no hook.
- **Buffer de Eventos**: Implementar um `useRef` para armazenar temporariamente eventos (`pendingEvents`) que chegam enquanto as configurações ainda estão carregando.
- **Processamento de Fila**: Adicionar um `useEffect` que monitora `settingsLoading`. Quando `settingsLoading` for `false`, processa todos os eventos em `pendingEvents`.
- **Proteção Realtime**: A função `processExternalEvent` verificará se as configurações estão prontas. Se não estiverem, adiciona ao buffer em vez de emitir imediatamente.

### 2. Componente `Topbar`
- **Integração**: Atualizar a chamada de `useExternalNotificationsRealtime` para passar os valores retornados por `useNotificationSettings`.

## Verificação
- **Tipo e Build**: Executar `tsgo` e `bun run build`.
- **Auditoria de Código**: Revisar a lógica de duplicidade (`processedIds`) para garantir que ela funcione corretamente com o buffer.

## Arquivos Afetados
- `src/features/whatsapp/hooks/use-external-notifications-realtime.ts`
- `src/components/layout/topbar.tsx`
