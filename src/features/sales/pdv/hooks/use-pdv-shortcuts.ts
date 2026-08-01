/**
 * PDV — Atalhos de teclado (Sprint 2.8).
 *
 * Este arquivo NÃO contém regra de negócio. Ele apenas traduz teclas em
 * chamadas para as MESMAS ações já usadas pelos botões do PDV
 * (`usePDV`, checkout, recebimento, conclusão/recibo).
 *
 * Mapa oficial (Sprint 2.8):
 *   ENTER   adicionar produto (busca / leitor)
 *   ESC     limpar pesquisa
 *   F2      cliente
 *   F3      quantidade do item ativo
 *   F4      desconto
 *   F5      pagamento
 *   F12     fechamento de caixa (abre o diálogo existente)
 *   DELETE  remover item ativo
 *   CTRL+L  limpar carrinho
 *
 * Rollback: excluir este arquivo e suas referências — nenhum outro módulo
 * depende dele.
 */
import { useEffect, useRef } from "react";

/** IDs dos campos onde os atalhos continuam válidos (busca e leitor). */
export const PDV_SEARCH_INPUT_ID = "pdv-search";
export const PDV_BARCODE_INPUT_ID = "pdv-barcode";
export const PDV_CUSTOMER_TRIGGER_ID = "pdv-customer";
export const PDV_DISCOUNT_INPUT_ID = "pdv-discount";
export const PDV_FINALIZE_BUTTON_ID = "pdv-finalize";
export const PDV_SHORTCUT_SAFE_IDS = [
  PDV_SEARCH_INPUT_ID,
  PDV_BARCODE_INPUT_ID,
] as const;

export type PdvShortcutAction =
  | "add-product"
  | "clear-search"
  | "open-customer"
  | "focus-quantity"
  | "focus-discount"
  | "open-payment"
  | "remove-item"
  | "clear-cart"
  | "focus-search"
  | "new-sale"
  | "print-receipt"
  | "confirm-dialog"
  | "close-dialog"
  | "close-cash";

/** Alvo do evento, no mínimo necessário para decidir (sem depender do DOM). */
export type PdvShortcutTarget = {
  tagName?: string;
  id?: string;
  type?: string;
  isContentEditable?: boolean;
} | null;

export type PdvShortcutEvent = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  target?: PdvShortcutTarget;
};

export type PdvShortcutContext = {
  /** Existe um diálogo aberto (recibo, caixa, confirmação...). */
  dialogOpen?: boolean;
};

const TEXT_TAGS = ["INPUT", "TEXTAREA", "SELECT"];

/**
 * `true` quando o usuário está digitando em um campo de texto que não é a
 * busca de produtos nem o leitor de código de barras.
 */
export function isTypingTarget(target: PdvShortcutTarget): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = (target.tagName ?? "").toUpperCase();
  if (!TEXT_TAGS.includes(tag)) return false;
  const id = target.id ?? "";
  return !PDV_SHORTCUT_SAFE_IDS.includes(id as (typeof PDV_SHORTCUT_SAFE_IDS)[number]);
}

/** `true` quando o alvo é a pesquisa ou o leitor (campos "de operação"). */
export function isPdvSearchTarget(target: PdvShortcutTarget): boolean {
  const id = target?.id ?? "";
  return PDV_SHORTCUT_SAFE_IDS.includes(
    id as (typeof PDV_SHORTCUT_SAFE_IDS)[number],
  );
}

/** Traduz a tecla em ação. Retorna `null` quando nada deve acontecer. */
export function resolvePdvShortcut(
  event: PdvShortcutEvent,
  context: PdvShortcutContext = {},
): PdvShortcutAction | null {
  if (event.altKey) return null;

  const ctrl = Boolean(event.ctrlKey || event.metaKey);
  const typing = isTypingTarget(event.target ?? null);

  // CTRL+L / CTRL+DELETE limpam o carrinho de qualquer lugar da tela.
  if (ctrl && !context.dialogOpen) {
    const key = event.key.toLowerCase();
    if (key === "l" || key === "delete") return "clear-cart";
    return null;
  }
  if (ctrl) return null;
  if (typing) return null;

  if (context.dialogOpen) {
    if (event.key === "Enter") return "confirm-dialog";
    if (event.key === "Escape") return "close-dialog";
    return null;
  }

  switch (event.key) {
    // Leitor USB (keyboard wedge) e digitação manual terminam com ENTER.
    case "Enter":
      return "add-product";
    case "Escape":
      return "clear-search";
    case "F2":
      return "open-customer";
    case "F3":
      return "focus-quantity";
    case "F4":
      return "focus-discount";
    case "F5":
      return "open-payment";
    case "F12":
      return "close-cash";
    case "Delete":
      // Dentro da pesquisa, DELETE é edição de texto normal.
      return isPdvSearchTarget(event.target ?? null) ? null : "remove-item";
    default:
      return null;
  }
}

export type PdvShortcutHandlers = Partial<
  Record<PdvShortcutAction, (() => void) | undefined>
>;

type MinimalEvent = PdvShortcutEvent & { preventDefault?: () => void };

/**
 * Teclas que pertencem ao PDV e NUNCA podem chegar ao navegador enquanto a
 * tela estiver ativa (RC2 / P0.1): F5 recarregava a página, F3 abria o
 * "localizar", F2/F4 vazavam. O bloqueio independe da ação estar disponível.
 *
 * Teclas de edição de texto (ENTER, ESC, DELETE) só são bloqueadas quando o
 * PDV realmente as usa — digitar em um campo continua normal.
 */
const OWNED_FUNCTION_KEYS = ["F2", "F3", "F4", "F5", "F12"] as const;

export function isPdvOwnedKey(event: PdvShortcutEvent): boolean {
  if (event.altKey) return false;
  const ctrl = Boolean(event.ctrlKey || event.metaKey);
  if (ctrl) {
    const key = event.key.toLowerCase();
    return key === "l" || key === "delete";
  }
  return OWNED_FUNCTION_KEYS.includes(
    event.key as (typeof OWNED_FUNCTION_KEYS)[number],
  );
}

/**
 * Cria o listener de `keydown`.
 *
 * O `preventDefault` acontece para toda tecla do PDV (mesmo sem handler
 * disponível); a ação em si só roda quando o handler existir — é assim que
 * cada atalho fica desabilitado conforme o estado da tela.
 */
export function createPdvShortcutHandler(
  getHandlers: () => PdvShortcutHandlers,
  getContext: () => PdvShortcutContext = () => ({}),
) {
  return function onKeyDown(event: MinimalEvent) {
    const action = resolvePdvShortcut(event, getContext());
    const owned = isPdvOwnedKey(event);
    if (action || owned) event.preventDefault?.();
    if (!action) return;
    const handler = getHandlers()[action];
    if (!handler) return;
    handler();
  };
}


export type PdvShortcutTargetLike = {
  addEventListener: (type: string, listener: (event: never) => void) => void;
  removeEventListener: (type: string, listener: (event: never) => void) => void;
};

/** Registra o listener e devolve a função de remoção. */
export function registerPdvShortcuts(
  target: PdvShortcutTargetLike,
  listener: (event: never) => void,
): () => void {
  target.addEventListener("keydown", listener);
  return () => target.removeEventListener("keydown", listener);
}

/** Helpers de foco/click — reutilizam os elementos já renderizados no PDV. */
function elementById(id: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById(id);
}

export function focusPdvElement(id: string) {
  const el = elementById(id);
  el?.focus();
  if (el && el instanceof HTMLInputElement) el.select();
}

export function clickPdvElement(id: string) {
  elementById(id)?.click();
}

export type UsePdvShortcutsOptions = {
  handlers: PdvShortcutHandlers;
  context?: PdvShortcutContext;
  enabled?: boolean;
  target?: PdvShortcutTargetLike | null;
};

/**
 * Registra os atalhos do PDV enquanto a tela estiver montada.
 * Nenhuma ação é implementada aqui: todas vêm de `handlers`.
 */
export function usePdvShortcuts({
  handlers,
  context,
  enabled = true,
  target,
}: UsePdvShortcutsOptions) {
  const handlersRef = useRef<PdvShortcutHandlers>(handlers);
  const contextRef = useRef<PdvShortcutContext>(context ?? {});

  useEffect(() => {
    handlersRef.current = handlers;
    contextRef.current = context ?? {};
  });

  useEffect(() => {
    const node =
      target ?? (typeof window === "undefined" ? null : (window as unknown as PdvShortcutTargetLike));
    if (!enabled || !node) return;
    const listener = createPdvShortcutHandler(
      () => handlersRef.current,
      () => contextRef.current,
    ) as (event: never) => void;
    return registerPdvShortcuts(node, listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, target]);
}
