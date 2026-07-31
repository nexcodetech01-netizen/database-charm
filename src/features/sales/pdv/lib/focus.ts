/**
 * PDV — Política de foco automático (Sprint 2.8).
 *
 * Camada 100% pura e sem DOM: apenas decide QUAL campo deve receber o foco
 * depois de cada evento da operação. Quem aplica o foco é o hook
 * `usePdvFocus` (uma linha de `element.focus()`).
 *
 * Nenhuma regra de negócio: não conhece SaleEngine, carrinho, fiscal ou caixa.
 */

/** IDs dos campos focáveis do PDV (mesmos IDs já renderizados na tela). */
export const PDV_FOCUS_IDS = {
  search: "pdv-search",
  discount: "pdv-discount",
  customer: "pdv-customer",
  finalize: "pdv-finalize",
} as const;

export type PdvFocusId = (typeof PDV_FOCUS_IDS)[keyof typeof PDV_FOCUS_IDS];

/** Eventos da operação que podem reposicionar o cursor. */
export type PdvFocusEvent =
  | "mount"
  | "product-added"
  | "scan"
  | "search-cleared"
  | "sale-completed"
  | "new-sale"
  | "dialog-closed";

/**
 * Eventos que devolvem o cursor à pesquisa. Toda a operação contínua do
 * balcão gira em torno desse campo.
 */
const BACK_TO_SEARCH: PdvFocusEvent[] = [
  "mount",
  "product-added",
  "scan",
  "search-cleared",
  "sale-completed",
  "new-sale",
  "dialog-closed",
];

/** Retorna o ID que deve receber o foco, ou `null` quando nada muda. */
export function resolvePdvFocus(event: PdvFocusEvent): PdvFocusId | null {
  return BACK_TO_SEARCH.includes(event) ? PDV_FOCUS_IDS.search : null;
}

export type PdvFocusController = {
  /** Notifica um evento e aplica o foco resolvido (se houver). */
  notify: (event: PdvFocusEvent) => PdvFocusId | null;
};

/**
 * Cria o controlador de foco. `focus` recebe o ID e é o único ponto que
 * toca o DOM — o que mantém esta camada testável em ambiente node.
 */
export function createPdvFocusController(
  focus: (id: PdvFocusId) => void,
  options: { enabled?: () => boolean } = {},
): PdvFocusController {
  return {
    notify(event) {
      if (options.enabled && !options.enabled()) return null;
      const target = resolvePdvFocus(event);
      if (target) focus(target);
      return target;
    },
  };
}

/** ID do input de quantidade de um item do carrinho. */
export function pdvQuantityInputId(uiKey: string): string {
  return `pdv-qty-${uiKey}`;
}
