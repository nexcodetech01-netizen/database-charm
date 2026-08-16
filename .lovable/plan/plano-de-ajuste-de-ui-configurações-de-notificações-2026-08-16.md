# Plano de Ajuste de UI: Configurações de Notificações

Refatoração visual do componente `NotificationSettingsPanel` para aumentar a densidade de informação, profissionalizar o design e melhorar a hierarquia visual, seguindo o padrão premium do NexOS.

## Mudanças Propostas

### UI/UX (Layout e Design)
- **Redução de Padding e Espaçamento**: Diminuir o padding interno dos cards e o gap entre os controles (Som e Push) para reduzir a altura total da tela.
- **Reestruturação dos Cards**:
    - Cabeçalho: Título e descrição curta.
    - Divisor sutil.
    - Controles: Som de Alerta e Notificação Push alinhados em lista.
- **Alinhamento Vertical**: Garantir que todos os switches estejam perfeitamente alinhados à direita em uma coluna única.
- **Destaque Especial**: Adicionar um acento visual sutil (borda lateral ou brilho discreto) no card "Pedidos do Catálogo" para sinalizar sua importância operacional.
- **Ícones e Tipografia**: Usar ícones de tamanho 14px e fontes refinadas para um look mais sofisticado.
- **Responsividade**: Ajustar paddings e tamanhos de toque para mobile, garantindo que os switches não toquem as bordas e permaneçam acessíveis.

## Detalhes Técnicos
- **Arquivo**: `src/components/settings/notification-settings-panel.tsx`
- **Componentes Shadcn**: Utilizar `Separator` ou bordas nativas do Tailwind para as divisórias.
- **Estilização**: Tailwind CSS v4 para as classes de layout (`flex`, `grid`, `padding`, `gap`).
- **Estados e Lógica**: Manter `useNotificationSettings` e `toggleSetting` intactos, preservando toda a funcionalidade original.

## Verificação
- Validar visualmente em desktop e mobile (simulação de viewport).
- Garantir que a densidade visual permite ver todos os cards sem excesso de scroll.
- Testar interação dos switches para confirmar que a lógica permanece funcional.
