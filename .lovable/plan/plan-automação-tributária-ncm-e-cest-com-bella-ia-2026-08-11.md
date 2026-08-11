# Plan - Automação Tributária (NCM e CEST) com Bella IA

Implementação da automação de dados tributários no formulário de produtos, incluindo sugestão por IA, busca autocomplete de NCM e herança por categoria.

## User Review Required

> [!IMPORTANT]
> A busca de NCM utilizará a tabela `ncm_master` local com fallback para a BrasilAPI. A sugestão por IA utilizará um novo motor via Gemini (Lovable AI Gateway).

- O botão "Sugestão IA" agora enviará o nome e categoria do produto para obter NCM/CEST.
- O campo NCM no formulário será transformado em um Command/Combobox para busca por descrição ou código.
- A seleção de categoria agora preencherá automaticamente o NCM se a categoria tiver um `default_ncm` configurado.

## Proposed Changes

### Products Feature

#### [NEW] [Fiscal AI Functions](src/features/products/lib/fiscal-ai.functions.ts)
- Criar função de servidor `suggestFiscalCodes` usando o Lovable AI Gateway (Gemini).
- Definir prompt especializado para classificação fiscal brasileira (NCM/CEST).

#### [Fiscal Form Component](src/features/products/components/product-form/modules/fiscal-form.tsx)
- Integrar `Command` do shadcn para o autocomplete de NCM.
- Adicionar estado de busca e resultados da tabela NCM.
- Conectar o botão "Sugestão IA" à nova função de servidor.

#### [Fiscal Autofill Hook](src/features/products/hooks/use-fiscal-autofill.ts)
- Aprimorar a lógica de herança de NCM pela categoria.
- Garantir que a mudança de categoria dispare a atualização do NCM no formulário.

#### [Product Form Main](src/features/products/components/product-form/index.tsx)
- Passar os estados e funções necessários para o `FiscalForm`.
- Sincronizar o hook `useFiscalAutofill` com as mudanças de categoria.

## Technical Details
- **IA Gateway:** Uso do modelo `gemini-2.0-flash-exp` para baixa latência e precisão tributária.
- **Deduplicação:** A busca autocomplete filtrará duplicatas da `ncm_master` e BrasilAPI.
- **UX:** Feedback visual (loading/toasts) durante a chamada da IA.
- **TanStack Start:** Utilização de `useServerFn` para as chamadas de IA seguras.
