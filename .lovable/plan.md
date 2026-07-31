
# Fiscal — Sprint 007.2.1 (Prontidão para configuração)

Objetivo: amanhã a única tarefa restante é (1) subir certificado A1 com senha, (2) informar API key TecnoSpeed/TecnoMicro em homologação e (3) emitir a primeira NF-e. Hoje entrego tudo o que fica antes disso.

## Escopo desta entrega

### 1. Banco de dados (uma migração)

- Nova tabela `public.fiscal_settings` (1:1 com empresa):
  - regime tributário, série, próxima numeração, ambiente padrão
  - natureza da operação, CFOP padrão, NCM padrão, UF emitente
  - CSC id + `csc_secret_id` (referência à tabela de segredos abaixo)
- Nova tabela `public.fiscal_secrets` (armazém restrito):
  - `kind` (`cert_password` | `provider_api_key` | `csc_token`), `owner_id` (cert ou provedor), `ciphertext bytea`
  - RLS **nega SELECT para authenticated**; leitura apenas via RPCs `SECURITY DEFINER` que o adapter do provedor usará
  - Criptografia com `pgp_sym_encrypt` usando chave de sessão passada pela edge (não fica em texto no banco)
- Estender `fiscal_provider_config`: `api_url`, `notes`, `webhook_url`, `last_health_check_at`, `last_health_status`, `last_health_message`, `has_api_key` (bool derivado)
- RPCs helpers (SECURITY DEFINER, com `has_permission` fiscal.manage):
  - `fiscal_set_certificate_password(cert_id, password)` → grava ciphertext em `fiscal_secrets`
  - `fiscal_set_provider_api_key(api_key)` → idem para provider config
  - `fiscal_delete_certificate(cert_id)` → apaga do storage + registros (só se inativo)

### 2. Server functions novas

Em `src/features/fiscal/v2/functions/fiscal.functions.ts`:

- `getFiscalSettings` / `updateFiscalSettings`
- `setCertificatePassword({ certificateId, password })`
- `deleteCertificate({ certificateId })`
- `setProviderApiKey({ apiKey })`
- `testProviderConnection()` — valida provedor + cert + api key configurados; para TecnoSpeed faz ping HTTP no endpoint público (`https://managersaas.tecnospeed.com.br/ManagerAPIWeb/nfe/health`) com tratamento de erro; grava resultado em `fiscal_provider_config.last_health_*`
- Ampliar schema aceito para `providerId`: `mock | tecnospeed | focus_nfe | nfe_io | plugnotas`

### 3. UI — `/fiscal/configuracao` com 4 abas

Componentes novos em `src/features/fiscal/v2/components/`:

- `company-fiscal-card.tsx` — Aba **Empresa**: mostra razão social, CNPJ, IE, endereço fiscal (dados vindos de `companies`), com botão "Editar cadastro" que abre `/configuracoes` (não duplicamos formulário)
- `fiscal-rules-card.tsx` — Aba **Regras Fiscais**: form (react-hook-form + zod) com regime tributário (Simples/Presumido/Real/MEI), UF, série, próxima numeração, ambiente padrão, natureza da operação, CFOP padrão, NCM padrão, CSC id + token (via `setProviderApiKey`-like)
- `provider-card.tsx` (reescrito) — Aba **Provedor**: select com TecnoSpeed/TecnoMicro em primeiro, focus_nfe, nfe_io, plugnotas, mock; campo API URL; input mascarado de API Key (envia via `setProviderApiKey`, nunca volta em GET); botão **Testar conexão** com badge de saúde (verde/vermelho/último check)
- `certificate-card.tsx` (ampliado) — Aba **Certificado A1**: mantém upload; adiciona (1) campo senha do certificado no upload (não é armazenada em texto — vai para `fiscal_secrets`), (2) botão **Alterar senha**, (3) botão **Remover** (só quando inativo), (4) exibe validade/dias restantes/emissor/thumbprint sem expor arquivo

Rota `src/routes/_authenticated/fiscal.configuracao.tsx` reorganizada em `<Tabs>`.

### 4. UI — Dashboard e detalhes

- Dashboard: já corrigido no turno anterior (breadcrumb, botão Configuração, banner, 9 KPIs). Adicionar **error state** (mensagem + retry) e **empty state** dedicado quando não houver NF-e nenhuma.
- Detalhes NF-e: adicionar botão **Copiar chave** com toast; tornar timeline mais legível (esconder JSON bruto atrás de "Ver payload").
- Todos botões desabilitados quando ação não se aplica (já implementado).

### 5. Bella / Quick Actions

- Verificar que os 4 quick prompts fiscais (`fiscal-issue`, `fiscal-status`, `fiscal-cancel`, `fiscal-search`) resolvem corretamente para as skills registradas
- Skill `fiscal.emit` (nova) — chama `issueFiscalFromSale` quando o LLM já tiver o `saleId`; se não tiver, retorna resposta pedindo a venda
- Ajustar catálogo de skills para expor os 4 nomes ao roteador

### 6. Qualidade

- `bun run build`, `tsgo --noEmit`, `bunx vitest run` verdes
- ESLint no diretório `src/features/fiscal/v2/` limpo

## Arquivos afetados (≈18)

**Migração**: 1 arquivo SQL

**Server functions (1 arquivo, ampliado)**:
- `src/features/fiscal/v2/functions/fiscal.functions.ts`

**Hooks (1 arquivo, ampliado)**:
- `src/features/fiscal/v2/hooks/use-fiscal.ts`

**Componentes novos/reescritos (6)**:
- `components/company-fiscal-card.tsx` (novo)
- `components/fiscal-rules-card.tsx` (novo)
- `components/provider-card.tsx` (reescrito)
- `components/certificate-card.tsx` (ampliado)
- `components/fiscal-details.tsx` (copiar chave)
- `components/fiscal-timeline.tsx` (payload colapsável)

**Rotas (2)**:
- `src/routes/_authenticated/fiscal.configuracao.tsx` (tabs)
- `src/routes/_authenticated/fiscal.tsx` (error/empty state)

**Bella (2)**:
- `src/features/fiscal/v2/skills/fiscal-emit.skill.ts` (nova)
- `src/features/fiscal/v2/skills/index.ts` (registro)

**Testes (1)**:
- `src/features/fiscal/v2/__tests__/fiscal-settings.test.ts` (novo)

## O que fica para amanhã (dependência real de você)

- Subir arquivo .pfx + senha no formulário do certificado
- Colar API Key TecnoSpeed/TecnoMicro no formulário do provedor
- Clicar **Testar conexão** → status verde
- Escolher uma venda paga → botão **Emitir NF-e**

O adapter real (assinar XML + POST TecnoSpeed) fica como Sprint 007.3 — hoje o fluxo cria o rascunho e registra o evento; amanhã ligamos o adapter na `issueFiscalFromSale`.

## Riscos

- Criptografia dos segredos via `pgp_sym_encrypt` exige a chave a cada chamada. Vou usar segredo `FISCAL_SECRETS_KEY` (gerado agora via `generate_secret`) lido no server function e passado à RPC. Aceitável para MVP; migrar para Supabase Vault fica como melhoria.
- `testProviderConnection` para TecnoSpeed depende de endpoint público de status. Se o endpoint mudar, o teste pode falhar mesmo com credencial válida — trato como aviso, não bloqueio.

## Fora do escopo (não vou fazer)

- Assinatura XML real / integração final SEFAZ (Sprint 007.3)
- Migração para Supabase Vault
- Testes E2E do fluxo completo com provedor real
- Reescrever `/configuracoes` da empresa (só linkamos)

Confirma que posso executar exatamente este plano? Só peço um "sim" (ou ajustes) para começar.
