# Plano de Implementação: Busca Automática de CEP via ViaCEP

Implementar a funcionalidade de preenchimento automático de endereço no "Passo 2: Destinatário" da calculadora de frete, utilizando a API pública ViaCEP quando um CEP válido de 8 dígitos for inserido.

## Alterações Sugeridas

### Frontend (`src/routes/_authenticated/ferramentas.calculadora-frete.tsx`)

1.  **Estado de Carregamento**:
    *   Adicionar um estado `isFetchingCep` para controlar o indicador de carregamento durante a busca na API ViaCEP.
2.  **Função de Busca (`handleCepBlur`)**:
    *   Criar uma função assíncrona para consultar `https://viacep.com.br/ws/{cep}/json/`.
    *   Validar se o CEP possui 8 dígitos numéricos.
    *   Mapear os campos da resposta: `logradouro` -> `address`, `bairro` -> `district`, `localidade` -> `city`, `uf` -> `state`.
    *   Utilizar `labelForm.setValue` para atualizar os campos do formulário.
    *   Garantir que os campos permaneçam editáveis.
3.  **Integração no Formulário**:
    *   Adicionar o evento `onBlur` ou monitorar o `onChange` no campo `postal_code` do `labelForm`.
    *   Exibir um spinner discreto ou desabilitar temporariamente os campos de endereço enquanto `isFetchingCep` for verdadeiro.

## Detalhes Técnicos

*   **API**: ViaCEP (JSON).
*   **Tratamento de Erros**: Se a API retornar `{"erro": true}` ou falhar, o sistema apenas encerra o carregamento sem bloquear o usuário, permitindo o preenchimento manual conforme solicitado.
*   **UX**: O usuário não precisa clicar em "buscar"; a ação ocorre ao terminar de digitar ou sair do campo.

## Validação

*   Testar com CEP válido (ex: 01310-100) e verificar se Rua, Bairro, Cidade e UF são preenchidos.
*   Testar com CEP inexistente e verificar se os campos permanecem editáveis e vazios.
*   Verificar se o indicador de carregamento aparece durante a requisição.
