# NexOS — Deploy

> Documentação oficial do processo de publicação. Toda publicação segue este documento.

---

## 1. Ambientes

| Ambiente | URL | Uso |
|---|---|---|
| **Preview** | `id-preview--<project-id>.lovable.app` | Desenvolvimento e QA |
| **Produção** | `nexos-design-foundry.lovable.app` (e domínio custom quando configurado) | Publicado |
| **Stable Preview** | `project--<project-id>-dev.lovable.app` | URL estável do preview (cron/webhooks) |
| **Stable Prod** | `project--<project-id>.lovable.app` | URL estável de produção (cron/webhooks) |

---

## 2. GitHub

- **Repositório oficial**: sincronizado automaticamente com o projeto Lovable.
- **Branch principal**: `main` — representa o estado publicado em produção.
- **Nunca** commitar direto em `main` sem passar pelo fluxo oficial (`BLUEPRINT.md` §6).
- **Nunca** executar `git reset`, `rebase` ou `force push` em `main`.

### Fluxo de commits
- Cada sprint gera commits atômicos com mensagens descritivas em português.
- Mensagens seguem o padrão: `<escopo>: <o que foi feito>` (ex: `clientes: adiciona timeline de interações`).
- Cada release atualiza o `CHANGELOG.md`.

---

## 3. Processo de publicação

### Frontend
Alterações de UI, componentes e código client-side **não vão live automaticamente** — requerem clique em **Publish/Update** no editor Lovable.

Passos:
1. Confirmar que o QA aprovou a sprint (`BLUEPRINT.md` §10).
2. Atualizar `CHANGELOG.md` com a versão nova.
3. Clicar em **Publish** (canto superior direito no desktop, canto inferior direito no mobile em Preview).
4. Confirmar publicação no dialog.
5. Validar produção pelo URL público.

### Backend
Migrations de banco, edge functions e server logic **vão live imediatamente** ao serem aprovadas — não requerem publish adicional.

**Cuidados**:
- Migration destrutiva **nunca** é aprovada sem plano de rollback.
- Alterações de RLS são revisadas linha a linha antes de aprovar.

---

## 4. Versionamento

- **Semantic Versioning** (`MAJOR.MINOR.PATCH`):
  - **MAJOR**: mudanças incompatíveis (arquitetura, quebra de contrato).
  - **MINOR**: sprint concluída, novo módulo ou feature relevante.
  - **PATCH**: correções e ajustes sem novo escopo.
- Cada versão é registrada no `CHANGELOG.md` referenciando a sprint do `ROADMAP.md`.
- Tags de versão são criadas no GitHub após a publicação em produção.

---

## 5. Checklist antes do deploy

Obrigatório — a sprint **não é publicada** sem todos os itens:

- [ ] Escopo entregue conforme aprovado pelo Product Owner.
- [ ] Build aprovado (`vite build`).
- [ ] TypeScript sem erros (`tsgo`).
- [ ] ESLint sem erros (warnings justificados).
- [ ] Console sem erros em runtime (dev + build).
- [ ] Responsividade validada (mobile, tablet, desktop).
- [ ] Migrations aprovadas e aplicadas em produção (backend deploy imediato).
- [ ] RLS verificada em todas as tabelas novas/alteradas.
- [ ] Sem regressões nos módulos vizinhos (smoke test manual).
- [ ] QA aprovado formalmente.
- [ ] `CHANGELOG.md` atualizado com a nova versão.
- [ ] `MODULES.md` atualizado se houve mudança de status de módulo.
- [ ] `BLUEPRINT.md` atualizado se houve mudança arquitetural.
- [ ] GitHub sincronizado.

---

## 6. Rollback

### Frontend
- Republicar a versão anterior via GitHub (revert do commit + publish).

### Backend
- Criar migration reversa (nunca `DROP` direto).
- Reverter edge function via redeploy da versão anterior.

### Storage
- Restaurar arquivos afetados via backup (ver `BACKUP.md`).

---

## 7. Domínio custom

- Projeto deve estar publicado antes de conectar domínio custom.
- Configuração em **Project Settings → Domains** ou no dialog de publicação.
- DNS gerenciado externamente conforme instruções da Lovable.

---

_Documento vivo — atualizar quando o processo de publicação mudar._
