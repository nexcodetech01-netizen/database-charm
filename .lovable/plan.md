# PDV: venda casada e sugestões por foto

## Objetivo
Adicionar sugestões de produtos complementares no PDV usando o catálogo local já carregado e permitir gerar descrição e tags a partir da foto principal no cadastro de produtos.

## Implementação
- Criar a lógica e o hook de sugestões de venda casada, reutilizando o ranqueador existente do WhatsApp.
- Exibir uma faixa discreta de sugestões no carrinho do PDV, sem criar consultas adicionais.
- Expor marca e catálogo carregado nos tipos e no índice local do PDV.
- Adicionar a leitura da foto principal pela Bella para sugerir descrição e tags.
- Integrar o novo comando ao formulário de multimídia e manter o texto existente quando já preenchido.

## Validação
- Executar os testes relacionados ao PDV e produtos.
- Validar tipagem e conferir a compilação automática do projeto.
