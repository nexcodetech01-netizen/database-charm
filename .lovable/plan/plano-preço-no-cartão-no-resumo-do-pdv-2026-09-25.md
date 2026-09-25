# Plano: preço no cartão no resumo do PDV

## Implementação
- Centralizar em `card-price` o cálculo do total no cartão: reprecificar cada preço efetivo, multiplicar pelas quantidades, somar, aplicar desconto geral e frete.
- Usar essa função compartilhada no checkout, eliminando a conta duplicada.
- Buscar a configuração da empresa no resumo do PDV e exibir, abaixo do total à vista, o total no cartão e a parcela máxima.
- Ocultar a linha quando o recurso estiver inativo ou o carrinho estiver vazio; atualizar automaticamente com qualquer alteração relevante no carrinho.

## Validação
- Cobrir os quatro cenários pedidos no teste unitário, incluindo preço editado e desconto.
- Validar tipagem, testes direcionados e compilação do projeto.

## Detalhes técnicos
- O `TOTAL` atual permanece inalterado e destacado como valor à vista.
- A nova linha terá `data-testid="pdv-card-total"` e será somente informativa, sem gravação no banco.
