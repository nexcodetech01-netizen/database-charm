# Plan - Painel de Configurações de Notificações e Otimização do Histórico

Adicionar controle granular de notificações por tipo de evento e melhorar a performance e usabilidade do histórico de alertas.

## User Review Required

> [!IMPORTANT]
> A persistência das preferências será feita na tabela `public.profiles` (coluna `notification_settings` do tipo JSONB). Se a tabela não existir ou não tiver essa coluna, ela será criada/atualizada via migration.

## Proposed Changes

### Database & Schema
- Criar migration para adicionar `notification_settings` à tabela `profiles` (ou `user_profiles` conforme padrão do projeto).
- Estrutura do JSONB: `{ "event_type": { "sound": boolean, "browser": boolean } }`.

### Components & UI
#### Notification Settings Panel
- Criar `src/components/settings/notification-settings-panel.tsx`.
- Interface para alternar som e notificações nativas para:
  - Pedidos do Catálogo
  - Vendas (Criada, Aprovada)
  - Financeiro (Vencimentos)
  - Estoque (Mínimo atingido)

#### Alerts History Enhancement
- Refatorar o popover de histórico na `Topbar` para suportar paginação.
- Adicionar filtros por: Data, Status (Lido/Não Lido), Tipo (Pedido, Financeiro, etc.).
- Otimizar a renderização com `Virtual List` se necessário (ou apenas paginação simples de 10 em 10).

### Services & Hooks
- Criar `src/hooks/use-notification-settings.ts` para gerenciar a persistência no Supabase.
- Atualizar `useBrowserNotifications.ts` para respeitar as configurações globais vindas do banco.
- Atualizar `Topbar.tsx` para integrar o novo painel de configurações (provavelmente em um novo diálogo ou expandindo o popover).

## Technical Details
- **RLS**: Garantir que o usuário só possa ler/editar suas próprias preferências.
- **Throttling**: Manter o mecanismo de agrupamento existente, mas agora filtrado pelas preferências.
- **BroadcastChannel**: Manter a sincronização entre abas para o estado de "lido".

## Context
O sistema já possui um histórico básico no `localStorage` e suporte a notificações nativas via `useBrowserNotifications`. A nova implementação moverá as configurações para o banco de dados e adicionará filtros/paginação ao histórico que hoje é uma lista simples.
