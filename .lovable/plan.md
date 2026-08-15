# Plano de Reestruturação do Fluxo de Pedido do Catálogo (Bella IA)

Este plano visa corrigir e reestruturar o fluxo de atendimento da Bella IA quando um pedido é recebido do catálogo (marcador `[PEDIDO-CATALOGO]`), garantindo que as etapas obrigatórias de confirmação, frete, pagamento e dados do cliente sejam seguidas rigorosamente.

## Mudanças Necessárias

### 1. Modelo de Dados (`src/features/whatsapp/inbound/checkout-session.ts`)
- Adicionar novos estados ao enum `CheckoutStep`: `waiting_fulfillment`, `waiting_payment`, `waiting_confirmation`.
- Expandir a interface `CheckoutSession` para suportar `fulfillment` e `payment` de forma consistente.
- Adicionar suporte a `deliveryFee` e `totalWithFreight`.

### 2. Motor de Estados (`src/features/whatsapp/inbound/checkout-session.ts`)
- Refatorar a função `advanceCheckout` para implementar a nova sequência:
  1. **Pedido Recebido** (via detector de intenção no roteador).
  2. **Confirmação de Frete/Entrega** (Taxa fixa de R$ 5,00 para Tupã).
  3. **Forma de Pagamento**.
  4. **Nome Completo**.
  5. **Endereço Completo** (Rua, Número, Bairro, CEP).
  6. **Resumo Final e Confirmação**.
- Implementar lógica para "Pular" perguntas se os dados já foram fornecidos no payload inicial.
- Garantir que para "Outra Cidade", o frete seja solicitado via CEP e não assumido como R$ 5,00.

### 3. Orquestração (`src/features/whatsapp/inbound/router.server.ts`)
- Ajustar o handler de `[PEDIDO-CATALOGO]` para:
  - Inicializar a sessão de checkout no estado correto.
  - Calcular o frete inicial se for Tupã.
  - Enviar a primeira resposta estruturada com o resumo dos itens + frete + pergunta de pagamento.

### 4. Intent Detector (`src/features/whatsapp/inbound/intent-detector.ts`)
- Melhorar o reconhecimento de formas de recebimento e pagamento para evitar duplicidade de perguntas.

## Detalhes Técnicos

### Nova Sequência de Estados
````text
CATALOG_ORDER_RECEIVED (via Router)
  ↓ (Calcula frete se Tupã)
waiting_payment (Pergunta: "Qual forma de pagamento?")
  ↓
waiting_buyer_name (Pergunta: "Qual seu nome?")
  ↓
waiting_zip_code (Se não informado)
  ↓
waiting_address (Rua, nº, Bairro)
  ↓
waiting_confirmation (Resumo final)
  ↓
done (Handoff para humano)
````

### Regras de Negócio
- **Frete Tupã:** R$ 5,00 fixo.
- **Frete Outros:** Solicitar CEP, informar que será confirmado pelo atendimento.
- **Deduplicação:** Se `msg.text` contém o nome ou CEP, pular a respectiva etapa.
- **Respostas:** Curtas, sem frases genéricas como "Com certeza!".

## Validação
- Execução de testes unitários em `src/features/whatsapp/inbound/__tests__/checkout-session.test.ts` (se existir ou criar novo).
- Simulação manual do fluxo via logs no preview.
