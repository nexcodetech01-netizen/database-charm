# Plano de Ajuste Cirúrgico: Formas de Pagamento para Envio (Outra Cidade)

Este plano altera as formas de pagamento disponíveis no checkout conversacional, restringindo "Dinheiro" apenas para entregas locais (Tupã) e removendo-a para envios para outras cidades.

## Alterações Propostas

### 1. Backend/Lógica de Negócio (`src/features/whatsapp/inbound/checkout-session.ts`)
- **Filtro de Opções de Pagamento**: No prompt `WAITING_PAYMENT_METHOD`, identificar dinamicamente se o pedido é para outra cidade.
- **Validação de Entrada**: No `advanceCheckout`, rejeitar "Dinheiro" se o pedido for "Envio para outra cidade", mesmo que o cliente tente digitar.
- **Transição de Estados**: Garantir que o estado `WAITING_CHANGE_INFO` (troco) nunca seja alcançado em pedidos de outra cidade.

### 2. Router (`src/features/whatsapp/inbound/router.server.ts`)
- **Captura de Contexto**: Garantir que a informação de fulfillment vinda do catálogo (`other` vs `tupa`) seja persistida corretamente na sessão.

## Detalhes Técnicos
- Utilizar `session.fulfillment` ou detectar via regex no `msg.text` inicial se o método é "other".
- Modificar o `case "WAITING_PAYMENT_METHOD"` para verificar `session.fulfillment === 'delivery'` e uma nova flag `session.isOtherCity` (ou similar baseada no catálogo).
- **Nota**: Como a sessão é efêmera e o catálogo já informa o tipo de entrega, usaremos essa informação como fonte de verdade.

## Verificação e Testes
- **Testes Unitários**: Criar `src/features/whatsapp/inbound/__tests__/payment-restriction.test.ts` cobrindo todos os cenários solicitados (Local vs Outra Cidade, bloqueio de troco, restrição de opções).
- **Typecheck**: Validar integridade dos tipos.
- **Build**: Garantir que a modificação não quebra a compilação.

## Critérios de Sucesso (Checklist)
- [ ] Local: PIX/Cartão/Dinheiro → PASS
- [ ] Outra cidade: PIX/Cartão → PASS
- [ ] Dinheiro bloqueado para outra cidade → PASS
- [ ] Troco preservado para entrega local → PASS
- [ ] WAITING_SHIPPING_FEE preservado → PASS
- [ ] Build → PASS
- [ ] Typecheck → PASS
