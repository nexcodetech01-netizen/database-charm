# Preço à vista e preço no cartão

## Objetivo
Aplicar um preço à vista existente e calcular automaticamente o preço no cartão com repasse integral da taxa, por empresa.

## Implementação
- Reutilizar uma configuração empresarial existente quando compatível; caso contrário, criar configuração própria com isolamento por empresa.
- Criar funções puras únicas para preço no cartão e parcela, com arredondamento sempre para cima.
- Adicionar a configuração e simulação em Vendas/Pagamentos.
- Exibir os dois preços no cadastro, listagem e catálogo público.
- No PDV, recalcular o total pela forma de pagamento, limitar parcelas e gravar o preço efetivamente cobrado e as parcelas.
- Verificar os módulos de produtos/vendas usados pela Bella para impedir fórmulas duplicadas.
- Cobrir a regra central e os fluxos alterados com testes.

## Detalhes técnicos
- A coluna atual de preço permanece inalterada e passa a ser rotulada como preço à vista.
- Não será criada coluna de preço no cartão por produto.
- Vendas históricas e crediário próprio não serão alterados.
