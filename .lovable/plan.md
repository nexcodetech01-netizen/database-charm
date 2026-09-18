# Pendências de devolução no caixa

## Objetivo
Garantir que cancelamentos pagos feitos sem caixa aberto deixem uma pendência visível e possam ser registrados depois, sem perder rastreabilidade.

## Implementação
1. Criar `pending_cash_reconciliations` com empresa, origem, referência, valor, tipo de movimento, motivo e dados de resolução; incluir validações, índices, permissões e acesso restrito aos membros da empresa.
2. Recriar `reverse_sale_finance` e `reverse_purchase_finance` preservando o cálculo atual e a nota de auditoria; quando a reversão em dinheiro não encontrar caixa aberto, registrar também uma pendência idempotente.
3. Criar uma função atômica para resolver uma pendência: travar a pendência, confirmar que continua aberta, localizar e travar o caixa aberto da mesma empresa, inserir o movimento e marcar a resolução na mesma transação.
4. Adicionar serviço, consultas e ação na tela de Caixa para exibir a quantidade, listar data/valor/referência/motivo e permitir “Registrar no caixa” somente quando houver caixa aberto.
5. Atualizar os tipos gerados, adicionar testes focados e validar tipos e build.

## Detalhes técnicos
- `cash_out` para estorno de receita e `cash_in` para estorno de despesa, exatamente como nas funções atuais.
- A pendência será única por lançamento financeiro e tipo de movimento, evitando duplicidade em reprocessamentos.
- A resolução usará função no banco para impedir registro duplo por cliques ou operadores simultâneos.
- Nenhum dado histórico existente será alterado.
