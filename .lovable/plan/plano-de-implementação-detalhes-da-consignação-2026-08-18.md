# Plano de Implementação: Detalhes da Consignação

Implementação da tela de detalhes de consignação, histórico de fechamentos e registro de novos acertos no NexOS Fashion.

## Ações

### Backend / Serviços
- Atualizar `ConsignmentService` para incluir o método `updateSettlementStatus`.
- Garantir a exportação de tipos em `types/index.ts`.

### UI / Componentes
- Criar `src/features/consignment/components/consignment-details.tsx`:
  - Cabeçalho com dados do revendedor, status e botão de PDF.
  - Tabela de itens com saldos (enviado, vendido, devolvido, extraviado, restante).
  - Tabela de histórico de fechamentos com botão para marcar como pago.
- Criar `src/features/consignment/components/register-settlement-dialog.tsx`:
  - Modal com formulário dinâmico para informar vendas, devoluções e extravios por item.
  - Validação para impedir que o total (vendido + devolvido + extraviado) exceda o saldo disponível.
  - Cálculo em tempo real do valor a receber.

### Roteamento
- Habilitar a rota `/_authenticated/consignacoes/$id` vinculada ao componente de detalhes.
- Corrigir a navegação na lista de consignações para apontar para a nova tela.

## Detalhes Técnicos
- O cálculo do valor a receber usará estritamente o `cost_price` de cada item, conforme o novo modelo de negócio.
- Utilização de `useSuspenseQuery` e `useMutation` do TanStack para gerenciamento de estado e feedback.
- Proteção de integridade de dados via `company_id` em todas as operações de escrita.
