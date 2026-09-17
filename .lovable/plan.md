# Busca flexível de produtos

## Objetivo
Substituir somente a função compartilhada de busca de produtos, mantendo sua assinatura e todas as telas consumidoras inalteradas.

## Implementação
- Criar uma nova migração com `CREATE OR REPLACE FUNCTION public.search_products_unaccent`.
- Normalizar e separar a consulta em palavras não vazias.
- Exigir correspondência de todas as palavras, permitindo que cada uma apareça em qualquer campo entre nome, SKU, marca, código de barras e descrição.
- Combinar busca parcial sem acento com `word_similarity` para tolerar pequenos erros de digitação.
- Manter os filtros de empresa e produto ativo.
- Ordenar primeiro por início exato do nome/SKU, depois por similaridade do nome e por ordem alfabética.
- Preservar as permissões existentes da função.

## Validação
- Aplicar a migração no banco.
- Validar consultas com palavras invertidas, trecho do SKU e erro simples de digitação.
- Confirmar que o projeto continua compilando sem alterações nas telas.
