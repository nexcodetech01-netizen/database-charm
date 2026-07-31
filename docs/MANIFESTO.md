# NexOS — Manifesto do Produto

> A partir da sprint **PRODUCT-001**, toda decisão de desenvolvimento no NexOS
> segue este manifesto. Ele tem prioridade sobre backlog, sobre ideias novas e
> sobre preferências individuais. Se uma sprint viola o manifesto, ela é
> reavaliada — nunca o manifesto.

**Objetivo:** deixar de "adicionar funcionalidades" e passar a construir o ERP
**mais simples, inteligente e produtivo** para pequenas e médias empresas
brasileiras.

Quando um lojista abre o NexOS pela primeira vez, ele deve pensar:

> "É muito mais fácil do que eu imaginava."

Nunca:

> "Por onde eu começo?"

---

## As 12 Regras

### Regra 1 — O NexOS trabalha pelo usuário
Nunca esperar que o usuário descubra o próximo passo. Sempre conduzir.

### Regra 2 — Toda funcionalidade tem que gerar valor
Antes de criar qualquer tela, botão ou módulo, responder:

- ✓ faz vender mais? **ou**
- ✓ economiza tempo? **ou**
- ✓ reduz erros? **ou**
- ✓ automatiza uma tarefa?

Se a resposta for **não**, **não implementar**.

### Regra 3 — Reutilizar antes de criar
Antes de criar componente novo, verificar se já existe na Platform:

`NextActionDialog` · `BellaInlineSuggestion` · `UndoManager` · `DraftStorage` ·
`ProductThumb` · `BellaProductCard` · `ProductSearch` · `Section` · `Card` ·
`Field` · `Metric`

Se existir, **reutilizar**. Nunca duplicar.

### Regra 4 — Melhorar antes de adicionar
Não adicionar módulos novos sem necessidade. Prioridade sempre para melhorar os
módulos existentes.

### Regra 5 — Uma pergunta por tela
Toda tela responde a **uma única pergunta**:

| Tela        | Pergunta                          |
| ----------- | --------------------------------- |
| Produtos    | O que estou vendendo?             |
| Venda       | Como vender?                      |
| Compra      | O que preciso comprar?            |
| Financeiro  | Quanto tenho?                     |
| Dashboard   | O que preciso resolver hoje?      |

Nunca misturar objetivos.

### Regra 6 — Eliminar cliques
Sempre que possível: **2 cliques → 1 clique**, **3 telas → 1 fluxo**.

### Regra 7 — Eliminar configurações
O padrão do sistema deve resolver 95% dos casos. Configuração só quando
realmente necessária.

### Regra 8 — Bella nunca responde só texto
Toda resposta da Bella IA termina com **uma ação clara**:

`[Vender agora]` · `[Criar campanha]` · `[Atualizar preços]` ·
`[Gerar pedido]` · `[Receber PIX]`

### Regra 9 — Uma sprint, uma categoria
Toda sprint é classificada em **exatamente uma** categoria:

🐞 Bug · 🎨 UX · ⚡ Performance · 🤖 Automação · 🌐 Integração · ✨ WOW

Nunca misturar.

### Regra 10 — Sempre existe um jeito mais simples
Antes de iniciar qualquer sprint, responder: *"Existe uma maneira mais
simples?"* Se existir, **essa é a implementação**.

### Regra 11 — Reutilizar a Platform
Toda funcionalidade nova reutiliza a Platform:

`DraftStorage` · `UndoManager` · `ProductSearch` · `ProductThumb` ·
`BellaProductCard` · `BellaInlineSuggestion` · `NextActionDialog` ·
`MetaIntegrationProvider`

Nunca reinventar soluções.

### Regra 12 — Preservar o núcleo
Toda alteração preserva, sempre que possível:

Application Layer · Services · Repositories · Banco · Triggers ·
Edge Functions · Financeiro · Estoque · Bella Pay · Pricing Engine · RBAC

---

## Checklist de Entrega de Sprint

Toda sprint deve informar:

- **Categoria** (uma das 6)
- **Objetivo** (uma frase)
- **Arquivos alterados**
- **Componentes reutilizados**
- **Impacto para o usuário**
- **Regras preservadas**
- **Typecheck**
- **Testes**

E confirmar:

- ✓ Menos cliques
- ✓ Menos configuração
- ✓ Mais automação
- ✓ Mais simplicidade
- ✓ Nenhuma complexidade desnecessária
- ✓ O NexOS continua trabalhando pelo usuário

---

## Referências cruzadas

- `docs/BLUEPRINT.md` — visão geral do produto
- `docs/UX_GUIDELINES.md` — padrão visual e de interação
- `docs/SPRINT_RULES.md` — processo operacional das sprints
- `docs/ROADMAP.md` — sequência de sprints planejadas
- `AGENTS.md` — regras para agentes de código
