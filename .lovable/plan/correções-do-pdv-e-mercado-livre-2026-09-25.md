# Correções do PDV e Mercado Livre

## Objetivo
Corrigir os três fluxos defeituosos na ordem solicitada e remover a faixa “Combina com” do PDV, sem alterar vendas existentes ou outras integrações.

## Implementação
1. **Preço do PDV**
   - Usar o preço efetivamente editado no carrinho e memorizar a lista enviada ao checkout.
   - Controlar a reprecificação por forma de pagamento e parcelas, impedir chamadas após confirmação e aguardar a última atualização antes de receber o pagamento.
   - Alterar a função do banco para relacionar cada item pela posição da linha, cobrindo itens avulsos e produtos repetidos com preços diferentes.

2. **Renovação do Mercado Livre**
   - Introduzir erro tipado com status e corpo da resposta.
   - Tratar apenas `invalid_grant`, 401 e 403 como necessidade de reconexão.
   - Preservar a integração em 429, 5xx, timeout ou falha de rede, respeitando `Retry-After` e sem repetir automaticamente o POST de refresh.

3. **Reconciliação de pedidos**
   - Renovar e reler o token antes de consultar cada integração.
   - Em 401, renovar uma vez, reler e repetir a consulta uma vez.
   - Se ainda falhar, registrar status HTTP e resposta do Mercado Livre para diagnóstico.

4. **Remoção de “Combina com”**
   - Retirar a faixa e seu hook do PDV.
   - Excluir os três arquivos exclusivos e testes que existam somente para essa funcionalidade.
   - Manter o carrinho ocupando normalmente o espaço disponível.

## Validação
- Cobrir reprecificação, bloqueio antes do pagamento e classificação das falhas do Mercado Livre com testes direcionados.
- Validar tipagem, testes relacionados e compilação.
- Informar, por item, o que mudou e como conferir os movimentos de estoque dos pedidos pagos nas últimas 24 horas.
