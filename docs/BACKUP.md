# NexOS — Backup e Recuperação de Desastres

> Estratégia oficial de backup, versionamento e recuperação. Aplica-se a todo o ambiente do NexOS.

---

## 1. Estratégia geral

Três camadas independentes de proteção:

1. **Código** → GitHub (versionamento contínuo).
2. **Banco de dados** → Supabase (backups automáticos + snapshots).
3. **Storage (arquivos)** → Supabase Storage (backups + versionamento de bucket).

Cada camada tem procedimento próprio de recuperação. Nunca depender de uma única camada.

---

## 2. GitHub (código)

### Estratégia
- Sincronização automática do projeto Lovable com o repositório GitHub.
- Branch `main` = fonte da verdade do código publicado.
- Histórico completo preservado (nunca `force push`, nunca `reset` em `main`).

### Recuperação
- Reverter commit específico: `git revert <sha>` + publish.
- Restaurar estado anterior: checkout de tag de versão + publish.
- Perda total do projeto Lovable: clonar do GitHub + reimportar.

### Frequência
- Contínua (a cada alteração aprovada).

---

## 3. Supabase — Banco de dados

### Estratégia
- **Backups automáticos diários** gerenciados pela Supabase (retenção conforme plano).
- **Point-in-Time Recovery (PITR)** disponível em planos Pro+ — recomenda-se ativar para produção.
- **Migrations versionadas** em `supabase/migrations/` — permitem reconstruir schema do zero.

### Snapshots manuais
Antes de operações críticas (migration destrutiva planejada, alteração de RLS em massa):

1. Ativar snapshot manual no painel Supabase.
2. Validar que o snapshot foi concluído.
3. Só então executar a operação.

### Recuperação
- **Restauração via painel**: usar o backup mais recente ou PITR para um timestamp específico.
- **Reconstrução completa**: aplicar migrations em ordem em um novo projeto Supabase + restaurar dados via backup.
- **Perda parcial de dados**: restaurar via query pontual em snapshot (export → insert seletivo).

### Frequência
- Backup automático: **diário**.
- Snapshot manual: **antes de cada migration crítica**.
- Teste de restauração: **trimestral** em ambiente de staging.

---

## 4. Supabase Storage (arquivos)

### Estratégia
- Buckets privados por padrão (`product-images` e futuros).
- Arquivos organizados por `company_id/` — facilita backup segmentado.
- **Versionamento de bucket** ativado quando disponível.

### Backup
- Sincronização periódica dos buckets para armazenamento externo (S3, GCS ou similar) via job agendado.
- Retenção mínima recomendada: **30 dias**.

### Recuperação
- Restaurar arquivo individual: download do backup externo + upload no bucket original com mesmo path.
- Restaurar bucket completo: sync reverso do backup externo.

### Frequência
- Sync incremental: **diária**.
- Sync full: **semanal**.

---

## 5. Versionamento

| Camada | Ferramenta | Retenção |
|---|---|---|
| Código | GitHub (branches + tags) | Ilimitada |
| Banco | Supabase backups + PITR | Conforme plano (7-30 dias típico) |
| Storage | Backup externo (S3/GCS) | Mínimo 30 dias |
| Documentação | GitHub (`docs/`) | Ilimitada |

Cada versão de código publicada em produção deve ter uma **tag Git correspondente** (`vX.Y.Z`) alinhada com o `CHANGELOG.md`.

---

## 6. Procedimento em caso de desastre

### Cenário 1: perda de código
1. Confirmar acesso ao repositório GitHub.
2. Clonar `main` em novo projeto Lovable ou ambiente local.
3. Validar build e publicar.

### Cenário 2: perda parcial de dados no banco
1. Identificar timestamp/registros afetados.
2. Comunicar Product Owner e usuários impactados.
3. Restaurar via PITR ou snapshot mais recente anterior ao incidente.
4. Aplicar diff de dados legítimos criados após o snapshot (se necessário).
5. Registrar incidente no `CHANGELOG.md`.

### Cenário 3: perda total do banco
1. Provisionar novo projeto Supabase.
2. Aplicar todas as migrations em ordem (`supabase/migrations/`).
3. Restaurar dados via backup mais recente.
4. Atualizar variáveis de ambiente do projeto.
5. Validar RLS, Auth e integrações.
6. Publicar frontend apontando para o novo backend.

### Cenário 4: perda de arquivos do Storage
1. Identificar buckets/paths afetados.
2. Restaurar do backup externo mais recente.
3. Validar policies de acesso.
4. Notificar usuários se URLs assinadas foram invalidadas.

### Cenário 5: comprometimento de segurança
1. Rotacionar imediatamente `service_role` e chaves de integração (Asaas, IA Gateway).
2. Revogar sessões ativas (`auth.admin.signOut`).
3. Auditar logs de acesso.
4. Aplicar patch de segurança.
5. Comunicar usuários afetados conforme LGPD.

---

## 7. Testes de recuperação

Obrigatório **trimestralmente**:

- [ ] Restaurar backup de banco em ambiente de staging.
- [ ] Validar integridade dos dados restaurados.
- [ ] Restaurar amostra de arquivos do Storage.
- [ ] Simular perda de código + reimportação do GitHub.
- [ ] Documentar tempo total de recuperação (RTO).
- [ ] Registrar resultado no `CHANGELOG.md`.

---

## 8. Responsabilidades

| Papel | Responsabilidade |
|---|---|
| **Tech Lead** | Garantir que backups estão ativos e testados. |
| **Product Owner** | Aprovar operações destrutivas e comunicar incidentes. |
| **QA Guardian** | Validar restaurações em testes trimestrais. |

---

_Documento vivo — revisar após cada incidente ou mudança de infraestrutura._
