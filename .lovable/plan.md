# Plano de Implementação: Cálculo Automático de Preço V2 (Mercado Livre)

Atualização da aba "Custos & Preço" do cadastro de produtos para integrar a formação de preço automática baseada em margem líquida e taxas de canal (Mercado Livre), utilizando o Motor Comercial V2.

## Ações Obrigatórias

1.  **Entrada de Dados e Margem**:
    *   Adicionar campo "Margem de Lucro Desejada (%)" com suporte a 2 casas decimais.
    *   Adicionar seletores para Taxa Variável de Canal (%) e Taxa Fixa de Canal (R$).
    *   Manter a reatividade dos custos unitários (Produto, Frete, Embalagem).

2.  **Integração com Motor Comercial V2**:
    *   Implementar a função `calculateFinalPrice` utilizando o `computeOfficialPricing` do motor oficial.
    *   Garantir o recálculo imediato (reativo) sempre que o Custo, Margem ou Taxas mudarem.
    *   Respeitar a fórmula de formação reversa: `Preço = (Custo + Fixos) / (1 - (Margem + Taxa% + Imposto%)/100)`.

3.  **Resumo Visual de Lucratividade (Financial Card)**:
    *   Criar um card dinâmico detalhando a composição do preço.
    *   Exibir Preço Final, Taxas totais do Canal e Lucro Líquido final (destacado).
    *   Integrar com as badges de status (Lucrativo/Prejuízo) já existentes.

## Detalhes Técnicos

*   **Motor**: Uso exclusivo de `src/features/pricing/official/official-pricing.ts`.
*   **UI**: Alterações em `src/features/products/components/product-form/modules/pricing-form.tsx`.
*   **Campos Novos no Form**:
    *   `channel_fee_pct` (number)
    *   `channel_fixed_fee` (number)
    *   `tax_pct` (opcional, vindo do motor/empresa)
*   **Validação**: Impedir preços infinitos quando a soma das deduções ultrapassa 100%.

```text
ESTRUTURA DO CARD FINANCEIRO:
[=] Preço de Venda: R$ 100,00
[-] Taxas (ML + Fixa): R$ 21,00 (15% + R$ 6,00)
[-] Custos Totais: R$ 50,00
[=] LUCRO LÍQUIDO: R$ 29,00 (29%)
```
