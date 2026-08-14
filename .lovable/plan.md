# Plano de Implementação: Passagem de Bastão Dinâmica (WhatsApp)

Implementar lógica de resposta dinâmica baseada no método de pagamento escolhido pelo cliente no fluxo de pré-venda do WhatsApp, garantindo a transição correta para o atendimento humano.

## Alterações

### 1. Detecção de Intenção e Método de Pagamento
- Atualizar `src/features/whatsapp/inbound/intent-detector.ts` para detectar o método de pagamento específico na mensagem do cliente.
- Criar a função `detectPaymentMethod(text: string): 'money' | 'pix_card' | null`.

### 2. Fluxo de Resposta no Roteador
- Modificar `src/features/whatsapp/inbound/router.server.ts` na seção `dataSubmission` para:
    - Identificar o método de pagamento.
    - Se for **DINHEIRO**: perguntar sobre o troco e enviar a mensagem de confirmação específica.
    - Se for **PIX ou CARTÃO**: enviar a mensagem de confirmação padrão para meios digitais.
    - Manter a alteração do status da conversa para `human` e pausar a Bella IA.

## Detalhes Técnicos
- Uso de expressões regulares em `intent-detector.ts` para identificar "dinheiro", "pix", "cartão", etc.
- As mensagens seguirão exatamente o texto solicitado:
    - Dinheiro: "Vai precisar de troco para quanto?" seguido de "Perfeito! Já anotamos. Um de nossos atendentes vai te chamar em instantes para confirmar a taxa de entrega e o horário do envio. Obrigado!"
    - Pix/Cartão: "Excelente! Já recebi seus dados. Um de nossos atendentes vai te chamar aqui em instantes para enviar a chave Pix ou link de pagamento e finalizar o seu pedido. Obrigado!"
