# Ajustes finais de preço e Mercado Livre

## Resultado
- Fazer o preço à vista e no cartão considerar o desconto individual de cada item exatamente como a gravação da venda.
- Manter a tela de status do Mercado Livre disponível quando a renovação falhar temporariamente.
- Permitir uma nova tentativa de gravação do preço ao confirmar o pagamento após uma falha anterior.

## Implementação
1. Ampliar os itens de preço do PDV com `discount` e centralizar os totais compartilhados:
   - cada linha à vista: `max(0, quantidade × preço unitário - desconto do item)`;
   - cada linha no cartão: `max(0, quantidade × preço reprecificado - desconto do item)`;
   - depois, descontar o desconto geral e somar o frete.
2. Usar o novo cálculo à vista compartilhado no checkout e manter o resumo usando o cálculo compartilhado do cartão.
3. No resumo da integração Mercado Livre, capturar somente a falha transitória da renovação, registrar aviso e continuar com os dados já lidos; falhas de autorização continuam seguindo a classificação existente.
4. Na confirmação do pagamento, limpar o erro guardado para a seleção atual e repetir a gravação uma vez antes de informar falha.
5. Adicionar o teste de R$ 100 com R$ 10 de desconto por item e validar os testes direcionados, a tipagem e a compilação automática.

## Limites
- Não alterar vendas já registradas.
- Não mudar os comportamentos dos jobs nem das ações de publicação/sincronização.
- Não modificar outras correções existentes.
