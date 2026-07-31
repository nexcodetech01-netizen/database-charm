/**
 * PDV — Atalhos de teclado (Sprint 2.8).
 *
 * Este arquivo NÃO contém regra de negócio. Ele apenas traduz teclas em
 * chamadas para as MESMAS ações já usadas pelos botões do PDV
 * (`usePDV`, checkout, recebimento, conclusão/recibo).
 *
 * Rollback: excluir este arquivo e suas referências — nenhum outro módulo
 * depende dele.
 */
import { useEffect, useRef } from "react";

/** IDs dos campos onde os atalhos continuam válidos (busca e leitor). */
export const PDV_SEARCH_INPUT_ID = "pdv-search";
export const PDV_BARCODE_INPUT_ID = "pdv-barcode";
export const PDV_CUSTOMER_TRIGGER_ID = "pdv-customer";
export const PDV_SHORTCUT_SAFE_IDS = [
  PDV_SEARCH_INPUT_ID,
  PDV_BARCODE_INPUT_ID,
] as const;

export type PdvShortcutAction =
  | "focus-search"
  | "focus-barcode"
  | "open-customer"
  | "new-sale"
  | "receive"
  | "print-receipt"
  | "confirm-dialog"
  | "close-dialog"
  | "clear-cart";

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

/** Traduz a tecla em ação. Retorna `null` quando nada deve acontecer. */
export function resolvePdvShortcut(
  event: PdvShortcutEvent,
  context: PdvShortcutContext = {},
): PdvShortcutAction | null {
  if (event.altKey) return null;
  if (isTypingTarget(event.target ?? null)) return null;

  const ctrl = Boolean(event.ctrlKey || event.metaKey);

  if (event.key === "Delete" && ctrl) return "clear-cart";
  if (ctrl) return null;

  if (context.dialogOpen) {
    if (event.key === "Enter") return "confirm-dialog";
    if (event.key === "Escape") return "close-dialog";
    return null;
  }

  switch (event.key) {
    case "F2":
      return "focus-search";
    case "F3":
      return "focus-barcode";
    case "F4":
      return "open-customer";
    case "F5":
      return "new-sale";
    case "F8":
      return "receive";
    case "F9":
      return "print-receipt";
    case "Escape":
      return "close-dialog";
    default:
      return null;
  }
}

export type PdvShortcutHandlers = Partial<
  Record<PdvShortcutAction, (() => void) | undefined>
>;

type MinimalEvent = PdvShortcutEvent & { preventDefault?: () => void };

/**
 * Cria o listener de `keydown`. Só chama o handler quando ele existir —
 * é assim que F5/F9/F8 ficam desabilitados conforme o estado da tela.
 */
export function createPdvShortcutHandler(
  getHandlers: () => PdvShortcutHandlers,
  getContext: () => PdvShortcutContext = () => ({}),
) {
  return function onKeyDown(event: MinimalEvent) {
    const action = resolvePdvShortcut(event, getContext());
    if (!action) return;
    const handler = getHandlers()[action];
    if (!handler) return;
    event.preventDefault?.();
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
  elementById(id)?.focus();
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
