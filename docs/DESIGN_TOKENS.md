# NexOS — Design Tokens

Fundação visual única (EPIC UI.1 · Sprint UI.1.1).

Os valores vivem em `src/styles.css`; os nomes de classe correspondentes ficam em
`src/design/tokens.ts`. Nenhum componente deve escolher cor, raio, sombra,
tamanho de texto, duração ou espaçamento fora desta tabela.

## 1. Status

12 tokens semânticos, cada um com três variáveis: base, `-foreground` e
`-surface` (superfície suave). Todos existem em tema claro e escuro.

| Token | Uso |
|---|---|
| `info` | Informação neutra, dicas |
| `success` | Operação concluída |
| `warning` | Atenção, requer ação futura |
| `danger` | Erro, ação destrutiva |
| `neutral` | Estado sem carga semântica |
| `critical` | Falha grave, bloqueio |
| `pending` | Aguardando processamento |
| `processing` | Em execução |
| `approved` | Aprovado/autorizado |
| `rejected` | Rejeitado |
| `cancelled` | Cancelado |
| `draft` | Rascunho |

Classes geradas: `bg-status-<token>`, `text-status-<token>`,
`border-status-<token>`, `bg-status-<token>-surface`,
`text-status-<token>-foreground`.

```tsx
import { statusToken } from "@/design";

<span className={statusToken("approved").soft}>Autorizada</span>;
```

**Proibido** usar `emerald`, `green`, `red`, `yellow`, `rose` ou `amber`
diretamente em componentes.

## 2. Radius

Apenas `sm`, `lg`, `xl` (`RADIUS_TOKENS`). `rounded-md` e `rounded-2xl` só
permanecem onde já existiam; novo código não deve introduzi-los.

## 3. Sombras

Quatro níveis: `shadow-surface`, `shadow-card`, `shadow-floating`,
`shadow-overlay`. `shadow-sm/md/lg` seguem existindo apenas por
compatibilidade e não devem ser usados em código novo.

| Token | Uso |
|---|---|
| `surface` | Blocos rentes à página |
| `card` | Cards e painéis |
| `floating` | Dropdowns, popovers, tooltips |
| `overlay` | Dialogs, sheets, drawers |

## 4. Tipografia

Escala única: `xs`, `sm`, `base`, `lg`, `xl`, `2xl` (`TEXT_TOKENS`).
Tamanhos arbitrários (`text-[9px]` … `text-[15px]`) são proibidos em código
novo.

## 5. Motion

| Token | Duração | Easing |
|---|---|---|
| `fast` | 120 ms | `--ease-standard` |
| `normal` | 200 ms | `--ease-standard` |
| `slow` | 320 ms | `--ease-emphasized` |

`INTERACTION_TOKENS.hover` e `INTERACTION_TOKENS.focus` padronizam hover e
foco visível. `prefers-reduced-motion` já é respeitado globalmente.

## 6. Spacing

| Token | Gap | Padding | Stack |
|---|---|---|---|
| `compact` | `gap-2` | `p-2` | `space-y-2` |
| `normal` | `gap-3` | `p-3` | `space-y-3` |
| `comfortable` | `gap-4` | `p-4` | `space-y-4` |
| `relaxed` | `gap-6` | `p-6` | `space-y-6` |

## Rollback

Esta sprint é puramente aditiva. Para reverter: remover `src/design/`,
`docs/DESIGN_TOKENS.md` e os blocos marcados `UI.1.1` em `src/styles.css`.
Nenhuma tela consome os tokens ainda, portanto não há impacto visual.
