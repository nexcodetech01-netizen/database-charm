# NexOS — PRODUCT-GUARD

> Diretrizes **obrigatórias** de desenvolvimento. A partir da sprint
> **PRODUCT-GUARD**, toda implementação segue este documento. Ele tem
> prioridade sobre sugestões de novas funcionalidades e complementa o
> `docs/MANIFESTO.md`. Em caso de conflito com backlog ou preferência
> individual, **este documento vence**.

---

## Missão

O NexOS **não** deve ser o ERP com mais funcionalidades.

O NexOS deve ser o ERP **mais simples, rápido e inteligente** para operar
uma empresa. Toda decisão prioriza **produtividade**.

---

## As 15 Regras

### Regra 1 — Simplicidade
Antes de implementar, perguntar: *"existe uma forma mais simples?"* Se
existir, **essa** será utilizada. Nunca escolher a solução mais complexa.

### Regra 2 — Um problema por sprint
Cada sprint resolve **um único problema** e é classificada em
**uma única categoria**:

🐞 Bug · 🎨 UX · ⚡ Performance · 🤖 Automação · 🌐 Integração · ✨ WOW

Nunca misturar categorias.

### Regra 3 — Não criar módulos
Antes de criar módulo novo, verificar se o problema cabe em um módulo
existente. **Evitar** novos menus, telas e cadastros.

### Regra 4 — Reutilização
Reutilizar **sempre** primeiro:

`DraftStorage` · `UndoManager` · `ProductSearch` · `ProductThumb` ·
`BellaProductCard` · `BellaInlineSuggestion` · `NextActionDialog` ·
`MetaIntegrationProvider` · `Section` · `Card` · `Metric` · `Field`

Nunca duplicar lógica.

### Regra 5 — Automação
Preferir **o sistema fazer** em vez de **o usuário configurar**.

### Regra 6 — Bella
Bella **nunca apenas informa**. Toda sugestão termina em **uma ação**.

### Regra 7 — UX
Eliminar cliques, campos, abas, menus e configurações sempre que possível.

### Regra 8 — Performance
Evitar novas queries, duplicação, loops, re-renderizações, uploads
desnecessários e consultas repetidas.

### Regra 9 — Backend
Preservar sempre que possível: Application Layer · Services ·
Repositories · Banco · Triggers · Edge Functions · RBAC · Pricing ·
Financeiro · Bella Pay · Estoque. Nunca alterar sem necessidade real.

### Regra 10 — Produto
Toda funcionalidade deve responder **sim** a pelo menos uma:

- ✓ faz vender mais?
- ✓ economiza tempo?
- ✓ reduz erros?
- ✓ automatiza trabalho?

Se não, **não implementar**.

### Regra 11 — Experiência
Nunca deixar o usuário pensando *"e agora?"*. Toda tela indica
naturalmente o próximo passo (usar `NextActionDialog` /
`BellaInlineSuggestion`).

### Regra 12 — Padrão
Todo componente novo segue o Design System existente. Nenhum estilo
paralelo.

### Regra 13 — Qualidade
Toda entrega informa obrigatoriamente:

Categoria · Objetivo · Arquivos alterados · Componentes reutilizados ·
Impacto para o usuário · Manifesto atendido · Typecheck · Testes.

### Regra 14 — Critério de aceite
Sprint só é concluída ao confirmar:

- ✓ Menos cliques
- ✓ Mais simplicidade
- ✓ Reutilização máxima
- ✓ Nenhuma complexidade desnecessária
- ✓ Nenhuma regra de negócio alterada
- ✓ Typecheck limpo
- ✓ Testes passando

### Regra 15 — Princípio do NexOS
Antes de entregar, responder internamente:

> *"Se eu fosse o dono da Bella Bolsas e usasse este sistema 8 horas por
> dia… isso realmente me ajudaria?"*

Se **não**, a funcionalidade volta para revisão.

---

## Objetivo final

O NexOS transmite **uma única** sensação:

> **"O sistema trabalha por mim."**

Nunca: *"preciso aprender a usar o sistema."*

---

## Referências cruzadas

- `docs/MANIFESTO.md` — 12 regras do produto
- `docs/BLUEPRINT.md` — visão geral do produto
- `docs/UX_GUIDELINES.md` — padrão visual e de interação
- `docs/SPRINT_RULES.md` — processo operacional das sprints
- `docs/ROADMAP.md` — sequência de sprints planejadas
- `AGENTS.md` — regras para agentes de código
