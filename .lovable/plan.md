# Otimizar consultas repetidas da Bella

## Objetivo
Reduzir as consultas contábeis duplicadas ao abrir a Bella Contadora, sem alterar cálculos, respostas ou regras de negócio.

## Alterações
- Adicionar um cache temporário compartilhado entre os providers durante uma única montagem do resumo.
- Reutilizar a mesma promessa de DRE para receita, lucro, despesas, pró-labore, saúde financeira e comparativos do mesmo período.
- Reutilizar a mesma promessa de KPIs para despesas, margem e saúde financeira do mesmo período.
- Criar um cache novo em cada chamada de `buildAccountingSummary`, impedindo reaproveitamento de dados entre aberturas.

## Validação
- Confirmar que o resumo continua produzindo os mesmos dados.
- Testar que DRE e KPIs do período atual são consultados apenas uma vez por montagem do resumo.
- Executar os testes direcionados e verificar a compilação automática.

## Detalhes técnicos
Somente `providers/index.ts` e `providers/summary.ts` serão alterados. Providers usados isoladamente, sem o cache temporário, continuarão consultando os serviços normalmente.
