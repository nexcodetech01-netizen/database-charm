# Plano de Ajuste de Validação de E-mail

O objetivo é tornar o campo de e-mail do destinatário opcional no formulário de frete, caso a API da SuperFrete não o exija como obrigatório.

## Análise Técnica
A API da SuperFrete (endpoint `/api/v0/cart`) geralmente exige o e-mail para fins de rastreamento e notificações, mas muitos usuários preferem não preenchê-lo. Se o e-mail for enviado como nulo ou vazio e a API aceitar, podemos tornar o campo opcional no frontend.

## Etapas
1. **Verificação da API**: Analisar a documentação (via conhecimento prévio/pesquisa) e o comportamento do backend atual.
2. **Atualização do Schema**: Modificar `src/features/shipping/types.ts` para permitir e-mail opcional (ou string vazia).
3. **Ajuste na Interface**: Atualizar `src/routes/_authenticated/ferramentas.calculadora-frete.tsx` para refletir que o campo não é mais obrigatório.

## Detalhes Técnicos
- Mudar `email: z.string().email("E-mail inválido")` para `email: z.string().email("E-mail inválido").optional().or(z.literal(""))`.
- Garantir que o backend trate a string vazia corretamente (enviando `null` ou omitindo o campo se a SuperFrete preferir).
