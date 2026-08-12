REVISÃO DE INTEGRAÇÃO E AUDITORIA CONCLUÍDA

1. PADRONIZAÇÃO DE CUSTOS E SOMATÓRIA:
   - Os Custos Operacionais Padrão (Embalagem, Seguro, Outros) agora são carregados automaticamente das `organization_settings` para novos produtos.
   - O `Custo Total Efetivo` é calculado rigorosamente como a soma de [Custo Unitário + Frete + Embalagem + Seguro + Outros].
   - Preço de Venda e Lucro Bruto são derivados exclusivamente do Custo Total Efetivo através do Motor Comercial V2.
   - Sincronização inteligente de frete/custo agora disponível mesmo para novos produtos ao selecionar um fornecedor (baseado em Nome/SKU se o produto ainda não existir).

2. VINCULAÇÃO REAL DE CATEGORIA E MARGEM:
   - A margem desejada é sincronizada dinamicamente com a categoria selecionada. O switch de margem agora exibe o valor real da categoria no Supabase.
   - A troca de categoria atualiza instantaneamente a margem aplicada se o switch estiver ativo.

3. BUSCA E CONSULTA DE PRODUTOS:
   - Os seletores de produtos no Inventário e na Composição de Kits agora ordenam por `created_at DESC`.
   - Limites de query foram ampliados (100-200 itens) para evitar ocultação de novos cadastros.

4. TRATAMENTO DE INTERFACE E EXCEÇÕES:
   - O botão "Sugestão Bella IA" agora possui tratamento robusto de estado no bloco `finally`, prevenindo travamentos visuais.
   - O campo de Estoque Inicial no `ProductForm` está desbloqueado para novos produtos, gerando automaticamente a movimentação de saldo inicial.
   - O hook `useFiscalAutofill` agora utiliza o campo "Modelo" como material para sugestões NCM mais precisas da Tabela Mestre.
