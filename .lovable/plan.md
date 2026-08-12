# Configuração e Integração Asaas & Secrets

Este plano corrige o comportamento do botão "Gerenciar" do Asaas, ajusta a lógica de status de conexão baseada em chaves reais e automatiza a criação do bucket de storage para imagens de produtos.

## Mudanças

### Backend (Infraestrutura)
- Criar migração SQL para garantir a existência do bucket  no Supabase Storage.
- Configurar políticas de RLS para o bucket: leitura pública e escrita/gestão apenas para usuários autenticados da empresa.

### Backend (Lógica)
- Refatorar a função de diagnóstico em `src/lib/diagnostics.functions.ts` para validar a presença das chaves de API do Asaas no banco de dados (`bella_pay_config`) em vez de apenas variáveis de ambiente, garantindo que o status "Conectado" reflita a configuração real do tenant.

### Frontend
- Ajustar `src/features/settings/central/sections/integracoes-section.tsx` para:
  - Vincular corretamente o botão "Gerenciar" do Asaas à rota `/bella-pay`.
  - Consultar o status real de conexão do Asaas via `testAsaasConnection` ou verificando as chaves no banco.
  - Corrigir a detecção de `companyId` via router context para evitar falhas de carregamento.

## Verificação Técnica
- Validar se o clique no card do Asaas redireciona para o painel de configuração.
- Confirmar se o badge "Conectado" só aparece quando há chaves válidas salvas.
- Verificar a criação do bucket e suas políticas de acesso via dashboard do Supabase ou logs de migração.
