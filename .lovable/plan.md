# Configuração de Provider Server-Side para Bella IA

Refatoração da seleção de provider para ocorrer de forma segura no backend, removendo a dependência de variáveis `VITE_*` no frontend e implementando diagnósticos de execução.

## User Review Required

> [!IMPORTANT]
> A seleção do provider passará a depender da variável de ambiente `BELLA_AI_PROVIDER` definida no servidor (Lovable Cloud). O frontend não terá mais controle sobre qual provider é o "preferido", apenas receberá a configuração do backend.

- A variável `BELLA_AI_PROVIDER` deve ser configurada no painel de Secrets como `openai`, `gemini` ou `mock`.
- A chave `OPENAI_API_KEY` deve estar presente para o provider `openai` funcionar.

## Proposed Changes

### AI Gateway & Providers
- **BellaAIGateway.ts**: 
    - Remover `VITE_BELLA_AI_PROVIDER`.
    - Implementar `getProviderConfig` (Server Function) para obter o provider ID do servidor.
    - Atualizar a inicialização para carregar a configuração do servidor.
    - Adicionar telemetria/diagnóstico no `runWithFallback` para registrar `provider`, `model`, `latency` e `fallbackUsed`.
- **OpenAIProvider.ts**: 
    - Atualizar para garantir que a telemetria capturada na server function seja repassada corretamente.

### Server Functions
- **get-provider-config.functions.ts**: (Nova) Server function para ler `process.env.BELLA_AI_PROVIDER` de forma segura.
- **interpret-openai.functions.ts**:
    - Adicionar logs de diagnóstico robustos.
    - Garantir que `fallbackUsed` seja detectável.

### Runtime & Diagnostics
- **runtime.ts**: Ajustar para exibir ou logar o diagnóstico do provider utilizado no `trace`.
- **Types**: Garantir que `AIResult` suporte os campos de diagnóstico solicitados.

## technical details

- **Security**: Nenhuma variável `process.env` ou `OPENAI_API_KEY` será exposta ao bundle do cliente.
- **Performance**: A configuração do provider será resolvida no momento da execução se ainda não estiver disponível.
- **Fallback**: Se `BELLA_AI_PROVIDER` não estiver definido ou o provider escolhido falhar, o sistema reverterá para o fallback existente (Gemini ou Mock).
- **Build**: `npm run build` será executado para validar a integridade e ausência de chaves no bundle.
