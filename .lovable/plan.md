# Plano de Melhoria: Troco no Checkout em Dinheiro

Adição de uma etapa opcional de troco no fluxo de checkout conversacional quando a forma de pagamento selecionada for "Dinheiro".

## Alterações

### 1. Modelo de Dados (`src/features/whatsapp/inbound/checkout-session.ts`)
- Adicionar `changeNeeded: boolean | null` e `changeAmount: number | null` à interface `CheckoutSession`.
- Adicionar um novo estado ao enum `CheckoutStep`: `WAITING_CHANGE_INFO`.
- Atualizar a função `createCheckoutSession` para inicializar os novos campos como `null`.

### 2. Lógica de Navegação (`src/features/whatsapp/inbound/checkout-session.ts`)
- Modificar o handler do estado `WAITING_PAYMENT_METHOD`:
  - Se o pagamento for "Dinheiro" (`cash`), transicionar para `WAITING_CHANGE_INFO` e perguntar sobre o troco.
  - Se for outro método, manter o fluxo atual.
- Implementar o handler para o novo estado `WAITING_CHANGE_INFO`:
  - Se a resposta for "não", registrar `changeNeeded = false` e avançar.
  - Se for um valor, validar se é maior ou igual ao total do pedido.
  - Registrar `changeAmount` e avançar se válido, ou repetir a pergunta com aviso se inválido.

### 3. Exibição do Resumo (`src/features/whatsapp/inbound/checkout-session.ts`)
- Atualizar `formatWebsiteOrderSummary` e `formatCheckoutSummary` para incluir as informações de troco quando o pagamento for em dinheiro.
  - "Troco: Não precisa" ou "Troco para: R$ XX,XX".

### 4. Integração Comercial (`src/features/whatsapp/inbound/commercial-inbox.ts` e `.server.ts`)
- Adicionar campos `change_needed` e `change_amount` na interface `CommercialTicketDraft`.
- Atualizar `buildCommercialTicketDraft` para mapear os dados da sessão para o draft do ticket.
- Atualizar `toRow` no servidor para incluir as novas colunas no banco de dados (usando a estrutura flexível de metadados se disponível, ou assumindo que a tabela suporta/será atualizada via RLS/Grants). *Nota: O usuário pediu para não criar campos novos se existir estrutura adequada. Vou verificar se a tabela `whatsapp_commercial_inbox` possui um campo `metadata` ou similar, ou se devo apenas incluir no objeto enviado.*

## Detalhes Técnicos
- Utilizar `normalize()` e regex para detectar "não" e extrair valores monetários da resposta do usuário.
- Garantir compatibilidade com sessões existentes (campos opcionais).

## Verificação
- Executar `bun run build` para garantir integridade dos tipos.
- Validar a lógica de transição entre estados.
