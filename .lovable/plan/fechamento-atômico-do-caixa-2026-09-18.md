# Fechamento atômico do caixa

## Objetivo
Eliminar a janela em que vendas ou movimentações podem entrar depois do cálculo do fechamento, preservando exatamente as regras atuais do resumo.

## Implementação
1. Criar uma nova migração com a função `public.close_cash_session(_session_id, _counted_cash, _closing_note)`.
2. Na mesma transação, a função irá:
   - bloquear a sessão com `FOR UPDATE` e validar existência, acesso à empresa e status aberto;
   - marcar a sessão como fechada antes da apuração;
   - consultar `view_cash_session_summary` para manter os totais canônicos atuais;
   - montar `by_method` com a mesma normalização usada hoje e excluir vendas de teste;
   - persistir todos os valores finais e retornar a linha atualizada.
3. Restringir a execução da função a usuários autenticados e ao serviço interno, mantendo RLS e validação de empresa.
4. Atualizar `closeSession()` para chamar somente a nova RPC e, após o fechamento, carregar o resumo detalhado para a resposta já usada pela tela.
5. Atualizar os tipos gerados da RPC e adicionar teste focado no novo caminho de fechamento.

## Validação
- Aplicar a migração e conferir assinatura, permissões e corpo da função no banco.
- Executar os testes de caixa e a verificação de tipos.
- Confirmar o build automático sem erros.

## Nota técnica
O fechamento e a captura dos números persistidos serão atômicos no banco. O resumo detalhado retornado à tela será lido depois apenas para apresentação; ele não participa mais da decisão nem dos valores gravados no fechamento.
