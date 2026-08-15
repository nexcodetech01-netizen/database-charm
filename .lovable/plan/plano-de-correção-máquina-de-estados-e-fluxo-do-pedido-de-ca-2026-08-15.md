# Plano de Correção: Máquina de Estados e Fluxo do Pedido de Catálogo

Corrigir a falha de "vazamento" de estado onde a Bella ignora o fluxo de checkout ativo e volta para a navegação genérica de produtos, além de ajustar a ordem e lógica do frete para Tupã conforme os novos requisitos.

## Alterações Sugeridas

### 1. Motor de Estados (`checkout-session.ts`)
- Mapear explicitamente os estados solicitados: `WAITING_RECEIPT_METHOD`, `WAITING_PAYMENT_METHOD`, `WAITING_CUSTOMER_NAME`, `WAITING_ADDRESS`, `WAITING_CONFIRMATION`.
- Simplificar `advanceCheckout` para ser estritamente sequencial.
- Remover saudações artificiais ("Com certeza!").
- Ajustar `formatCheckoutSummary` para exibir frete de forma clara.

### 2. Roteamento e Orquestração (`router.server.ts`)
- Priorizar `handleCheckoutTurn`: se houver uma sessão ativa, a mensagem DEVE ser processada pelo checkout, ignorando intenções de catálogo/busca.
- Ajustar a inicialização do pedido vindo do catálogo para calcular o frete de Tupã (R$ 5,00) imediatamente e pular para a pergunta de pagamento.

### 3. Parser de Intenção (`intent-detector.ts`)
- Melhorar o reconhecimento de [PEDIDO-CATALOGO].
- Capturar dados pré-existentes (Nome, CEP) para pular etapas.

## Detalhes Técnicos
- Utilizar `peekCheckoutSession` para bloquear roteamento genérico.
- Manter a persistência efêmera (30 min) já existente.
- Garantir que `money()` use espaços normais para evitar falhas em regex de testes.

## Validação
- Executar a suíte de testes `checkout-flow-repro.test.ts`.
- Simular o cenário real reportado (Tiele Andriani) para garantir que não haja abertura de categorias durante o checkout.
