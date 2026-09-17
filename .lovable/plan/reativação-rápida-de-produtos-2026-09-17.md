# Reativação rápida de produtos

## Objetivo
Permitir localizar e reativar produtos inativos diretamente na lista, sem alterar o formulário de edição.

## Implementação
- Criar uma nova migração da busca flexível com o parâmetro opcional `include_inactive` no final da assinatura.
- Manter produtos ativos como padrão e incluir inativos somente quando o controle da tela estiver ligado.
- Repassar esse controle na chamada da busca textual.
- Adicionar “Ativar produto” ao menu das linhas inativas, usando a atualização de produto já existente.
- Atualizar os tipos gerados pela alteração da função.

## Validação
- Confirmar no banco que a mesma busca exclui inativos por padrão e os inclui quando solicitado.
- Validar a compilação da aplicação.
