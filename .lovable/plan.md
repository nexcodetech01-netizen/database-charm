# Unicidade de código de barras por empresa

## Implementação
- Criar a migração que limpa códigos de barras históricos duplicados, preservando o registro mais antigo e limpando os demais.
- Criar o índice único parcial por empresa, ignorando valores ausentes, vazios e `SEM GTIN`.
- Adicionar a identificação específica de conflito de código de barras no utilitário de deduplicação.
- Traduzir esse conflito em mensagem clara tanto no cadastro comum quanto nas importações e criações feitas pela Bella.

## Validação
- Aplicar a migração e confirmar que não restaram colisões elegíveis.
- Executar a verificação de tipos, testes relacionados e confirmar o build da prévia.

## Detalhes técnicos
- Arquivos: nova migração, `product-dedupe.ts`, `products.service.ts` e `product.repository.ts`.
- O código de barras real nunca receberá sufixo inventado; colisões históricas mais recentes ficarão sem código para reconferência.
