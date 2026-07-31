# NexOS — Sprint Rules

> Documento oficial do fluxo de Sprint do NexOS. Complementa o `BLUEPRINT.md` (§6, §10), o `ROADMAP.md` e o `ENGINEERING.md` (§8).
>
> Toda Sprint — sem exceção — segue este documento.

---

## 1. Fluxo obrigatório da Sprint

Toda Sprint executa **as 12 etapas abaixo, nesta ordem**. Nenhuma etapa pode ser pulada, invertida ou executada em paralelo com a anterior.

### 1. Product Owner analisa
- Avalia se o escopo resolve um problema real do usuário.
- Verifica alinhamento com a visão do NexOS.
- Confirma prioridade contra o `ROADMAP.md`.
- Decide: **✅ Aprovar**, **❌ Adiar**, **🔄 Reavaliar**.
- Sem aprovação do PO, a Sprint **não inicia**.

### 2. Tech Lead cria o plano
- Define objetivo único da Sprint em 1 frase.
- Descreve arquitetura, componentes reutilizáveis e padrões aplicáveis.
- Identifica dependências entre módulos.
- Define critérios de aceite técnicos.

### 3. Lista arquivos que serão alterados
- Lista **explícita** de todos os arquivos a criar ou alterar.
- Se >10 arquivos, **parar e confirmar** com o PO antes de prosseguir.
- Nenhum arquivo fora dessa lista é tocado durante a implementação.

### 4. Avaliação de impacto
- Módulos afetados direta e indiretamente.
- Tabelas do banco criadas ou alteradas.
- Riscos técnicos (RLS, performance, regressão).
- Plano de mitigação e rollback.

### 5. Implementação
- Somente o escopo aprovado, respeitando a lista de arquivos.
- Padrões do `ENGINEERING.md` obrigatórios.
- Reutilização de componentes existentes (`src/components/ui/`, `src/components/layout/`).
- **Proibido** alterar módulos fora do escopo.
- **Proibido** implementar múltiplos módulos na mesma Sprint.

### 6. Build
- `vite build` deve concluir sem erros.
- Nenhum warning novo relevante.

### 7. TypeScript
- `tsgo` sem erros.
- `strict: true` respeitado.
- Sem `any` implícito, sem `@ts-ignore` sem justificativa.

### 8. ESLint
- ESLint sem erros.
- Warnings justificados por escrito.

### 9. QA
- QA Guardian executa o checklist completo (§5).
- Testa regressão nos módulos vizinhos.
- Emite parecer **✅ Aprovado** ou **❌ Reprovado**.
- Sem aprovação do QA, a Sprint **não é encerrada**.

### 10. Atualização do CHANGELOG
- `docs/CHANGELOG.md` atualizado com a nova versão semântica.
- Referência à Sprint (`ROADMAP.md`).
- Seções: Adicionado, Alterado, Corrigido, Removido, Segurança.
- `docs/MODULES.md` atualizado se houve mudança de status.
- `docs/BLUEPRINT.md` atualizado se houve mudança arquitetural.

### 11. GitHub sincronizado
- Branch `main` atualizada e representando o estado publicado.
- Nenhum commit pendente fora do fluxo oficial.
- Tag de versão criada (`vX.Y.Z`) alinhada ao `CHANGELOG.md`.

### 12. Sprint encerrada
- Publicação em produção (frontend via **Publish/Update**; backend já ativo).
- Comunicação formal ao time do encerramento.
- Retrospectiva registrada (o que funcionou, o que ajustar).
- Sprint marcada como concluída no `ROADMAP.md`.

---

## 2. Critérios para iniciar uma Sprint

Uma Sprint só pode iniciar quando **todos** os critérios abaixo estão atendidos:

- [ ] Escopo aprovado formalmente pelo Product Owner.
- [ ] Objetivo único definido em 1 frase.
- [ ] Plano técnico do Tech Lead entregue.
- [ ] Lista completa de arquivos a alterar (≤10 ou confirmação explícita).
- [ ] Impacto avaliado (módulos, banco, riscos, rollback).
- [ ] Dependências resolvidas (nenhum bloqueio pendente).
- [ ] Sprint anterior **totalmente encerrada** (nunca iniciar sobre Sprint aberta).
- [ ] `main` estável, sem erros conhecidos em produção.

Se qualquer item estiver aberto, a Sprint **não inicia**.

---

## 3. Critérios para concluir uma Sprint

Uma Sprint só é concluída quando **todos** os itens do checklist estão marcados (`BLUEPRINT.md` §10):

- [ ] Escopo entregue exatamente como aprovado.
- [ ] Build aprovado (`vite build`).
- [ ] TypeScript sem erros (`tsgo`).
- [ ] ESLint sem erros (warnings justificados).
- [ ] Console sem erros em runtime (dev e produção).
- [ ] Responsividade validada (mobile, tablet, desktop).
- [ ] Sem regressões nos módulos vizinhos (smoke test manual).
- [ ] RLS verificada em toda tabela nova/alterada.
- [ ] Migrations aprovadas e aplicadas.
- [ ] QA aprovado formalmente.
- [ ] `CHANGELOG.md` atualizado.
- [ ] `MODULES.md` / `BLUEPRINT.md` / `ROADMAP.md` atualizados quando aplicável.
- [ ] GitHub sincronizado (`main` + tag de versão).
- [ ] Publicação realizada e validada em produção.

Sem **todos** os itens marcados, a Sprint **não é considerada concluída**.

---

## 4. Quando uma Sprint deve ser interrompida

A Sprint deve ser **imediatamente interrompida** em qualquer um destes cenários:

### Interrupção crítica (parada obrigatória)
1. **Bug crítico em produção** afetando usuários (ver §5).
2. **Falha de segurança** identificada (vazamento, RLS quebrada, secret exposto).
3. **Perda ou corrupção de dados** — acionar `BACKUP.md`.
4. **Quebra de arquitetura** detectada durante a implementação.
5. **Escopo aprovado se mostra inviável** (dependência externa quebrada, decisão de produto reavaliada).

### Interrupção controlada (pausa para revisão)
6. Lista de arquivos ultrapassa >10 sem confirmação prévia.
7. Implementação começa a tocar módulos fora do escopo.
8. Regressão relevante identificada em módulo vizinho.
9. QA identifica problema **Crítico** ou **Alto** que exige replanejamento.
10. Product Owner altera prioridade estratégica.

### Procedimento de interrupção
1. Parar imediatamente qualquer implementação em andamento.
2. Registrar motivo da interrupção.
3. Product Owner + Tech Lead avaliam: retomar, replanejar ou cancelar.
4. Se retomar, revisar escopo, arquivos e impacto antes de continuar.
5. Registrar no `CHANGELOG.md` se algo já foi mergeado.

---

## 5. Como tratar bugs críticos

Bugs críticos **têm prioridade máxima** e podem interromper Sprints em andamento.

### Classificação
- **P0 — Crítico**: sistema fora do ar, perda de dados, falha de segurança, bloqueio de fluxo essencial (login, cadastro, salvar dados).
- **P1 — Alto**: funcionalidade importante quebrada sem workaround, afeta múltiplos usuários.
- **P2 — Médio**: funcionalidade parcial quebrada, com workaround.
- **P3 — Baixo**: cosmético, sem impacto operacional.

### Fluxo para P0 / P1
1. **Interromper** a Sprint atual (§4).
2. Product Owner confirma a criticidade em ≤15 min.
3. Tech Lead diagnostica a causa raiz — **nunca** aplicar patch cego.
4. Aplicar correção **mínima** e cirúrgica no arquivo afetado.
5. QA valida a correção + regressão nos módulos vizinhos.
6. Atualizar `CHANGELOG.md` com entrada de correção (patch version).
7. Publicar imediatamente.
8. Retomar a Sprint interrompida ou replanejar.

### Fluxo para P2 / P3
- Entram no backlog priorizado.
- São incluídos em Sprints futuras conforme critério do Product Owner.
- **Nunca** ultrapassam prioridade de P0/P1 ativos.

### Regras
- Bug crítico **nunca** é corrigido junto com feature na mesma alteração.
- **Nunca** aplicar workaround permanente sem tratar a causa raiz.
- Toda correção passa pelo fluxo oficial — mesmo urgente, em versão condensada.

---

## 6. Como tratar mudanças de escopo

O escopo aprovado no início da Sprint é **contrato fechado**. Mudanças exigem processo formal.

### Antes de iniciar a Sprint
- Product Owner pode alterar livremente.
- Tech Lead re-planeja arquivos e impacto se necessário.

### Durante a Sprint
Mudanças de escopo em Sprint aberta **são a exceção**, não a regra. Processo obrigatório:

1. **Solicitação formal** ao Product Owner com justificativa.
2. Product Owner avalia:
   - A mudança é realmente crítica agora?
   - Pode entrar na próxima Sprint?
   - Impacta o objetivo único da Sprint atual?
3. Se **adiar**: registrar no backlog do `ROADMAP.md`.
4. Se **aprovar**: Tech Lead reavalia:
   - Novo escopo é compatível com capacidade restante?
   - Precisa remover algo do escopo atual para compensar?
   - Impacto em arquivos e módulos.
5. Nova aprovação formal do PO + Tech Lead.
6. Atualizar plano, lista de arquivos e impacto.
7. Comunicar ao QA que o escopo mudou (ele revisa o novo escopo, não o antigo).

### Regras
- **Nunca** aceitar "só mais uma coisinha" — toda adição segue o processo.
- **Nunca** implementar melhorias não solicitadas ("já que está mexendo aqui...").
- **Nunca** aprovar mudança que quebre o objetivo único da Sprint — nesse caso, encerrar a Sprint atual e planejar nova Sprint.
- Toda mudança aprovada é registrada no `CHANGELOG.md` referenciando a Sprint.

### Sinais de alerta
- Mais de 1 mudança de escopo na mesma Sprint → planejamento inicial deficiente, revisar no retrospecto.
- Mudança que dobra o escopo → **rejeitar** e criar nova Sprint.
- Mudança justificada por "cliente pediu agora" → PO valida se é realmente crítico ou se pode entrar em backlog.

---

## 7. Responsabilidades por etapa

| Etapa | Responsável | Aprovação obrigatória |
|---|---|---|
| 1. Análise | Product Owner | Sim — inicia ou barra a Sprint |
| 2. Plano técnico | Tech Lead | Sim — arquitetura protegida |
| 3. Lista de arquivos | Tech Lead | Sim — se >10, PO confirma |
| 4. Avaliação de impacto | Tech Lead | Sim — riscos aceitos |
| 5. Implementação | Time de dev | — |
| 6. Build | Time de dev | Automático |
| 7. TypeScript | Time de dev | Automático |
| 8. ESLint | Time de dev | Automático |
| 9. QA | QA Guardian | Sim — encerra ou reprova |
| 10. CHANGELOG | Tech Lead | — |
| 11. GitHub | Tech Lead | — |
| 12. Encerramento | Product Owner | Sim — declara Sprint concluída |

---

## 8. Princípios inegociáveis

1. **Nenhuma etapa pulada.** Mesmo em urgência, o fluxo se mantém — apenas condensado.
2. **Escopo aprovado é contrato.** Mudanças exigem novo processo.
3. **Uma Sprint = um objetivo.** Múltiplos módulos na mesma Sprint são proibidos.
4. **QA é bloqueante.** Sem aprovação, não publica.
5. **Documentação é parte da entrega.** Sprint sem `CHANGELOG.md` atualizado não é concluída.
6. **Bug crítico interrompe tudo.** Sem exceção.
7. **Simplicidade > pressa.** Melhor adiar do que entregar frágil.

---

_Documento vivo — atualizar quando o processo de Sprint evoluir._
