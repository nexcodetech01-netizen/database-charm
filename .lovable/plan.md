# Plano de Implementação: Campo "Formato" na Calculadora de Frete

Adicionar suporte à seleção do formato da embalagem (Caixa, Rolo, Envelope) no Passo 1 da calculadora de frete, integrando com a API da SuperFrete.

## Alterações Sugeridas

### 1. Tipagem e Schema (`src/features/shipping/types.ts`)

*   Adicionar o campo `format` ao `ShippingCalculatorSchema`.
*   Valores aceitos (conforme SuperFrete): `1` (Caixa/Pacote), `2` (Rolo/Cilindro), `3` (Envelope).
*   Atualizar o tipo `ShippingCalculatorInput`.

### 2. Backend (`src/routes/api/public/shipping/calculate.ts` e `labels.ts`)

*   Receber o campo `format` no payload.
*   Mapear para o campo `package.format` esperado pela API da SuperFrete.
*   Garantir que o valor padrão seja `3` (Envelope) caso não enviado, mas idealmente virá do frontend.

### 3. Frontend (`src/routes/_authenticated/ferramentas.calculadora-frete.tsx`)

*   Adicionar o seletor (Select) "Formato" no Passo 1.
*   Definir "Envelope" (`3`) como valor padrão no `defaultValues` do formulário.
*   Implementar lógica visual para o formato Envelope:
    *   Segundo a SuperFrete, para Envelope, a **Altura** (`height`) deve ser fixa em `2` cm no payload (valor mínimo para processamento), embora na UI possamos manter a flexibilidade ou simplificar.
    *   O usuário solicitou que no Envelope foquemos em Peso, Altura e Largura.
*   Atualizar a função `onCalcSubmit` para incluir o novo campo.

## Detalhes Técnicos (SuperFrete)

*   Campo no payload: `package.format`.
*   Valores:
    *   `1`: Caixa / Pacote
    *   `2`: Rolo / Cilindro
    *   `3`: Envelope

## Validação

*   Testar cotação com as 3 opções.
*   Validar se o payload enviado ao backend contém o `format` correto.
*   Confirmar retorno da API SuperFrete para o CEP 17607-100 -> 19505-254 (conforme pedido pelo usuário).
