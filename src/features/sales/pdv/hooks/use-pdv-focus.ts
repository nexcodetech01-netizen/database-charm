import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  createPdvFocusController,
  PDV_FOCUS_IDS,
  pdvQuantityInputId,
  type PdvFocusEvent,
  type PdvFocusId,
} from "../lib/focus";
import { focusPdvElement } from "./use-pdv-shortcuts";

type Options = {
  /** Foco automático só ocorre quando o PDV está operável (caixa aberto). */
  enabled?: boolean;
};

/**
 * usePdvFocus — aplica a política de foco automático do PDV (Sprint 2.8).
 *
 * A decisão de "para onde vai o cursor" vive em `lib/focus.ts` (pura).
 * Aqui só existe o efeito colateral de `focus()` no elemento já renderizado.
 */
export function usePdvFocus({ enabled = true }: Options = {}) {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const controller = useMemo(
    () =>
      createPdvFocusController((id: PdvFocusId) => {
        // Aguarda o commit do React antes de mover o cursor.
        if (typeof window === "undefined") return;
        window.requestAnimationFrame(() => focusPdvElement(id));
      }, { enabled: () => enabledRef.current }),
    [],
  );

  const notify = useCallback(
    (event: PdvFocusEvent) => controller.notify(event),
    [controller],
  );

  const focusSearch = useCallback(() => {
    focusPdvElement(PDV_FOCUS_IDS.search);
  }, []);

  const focusDiscount = useCallback(() => {
    focusPdvElement(PDV_FOCUS_IDS.discount);
  }, []);

  const focusQuantity = useCallback((uiKey: string | null) => {
    if (!uiKey) return;
    focusPdvElement(pdvQuantityInputId(uiKey));
  }, []);

  // Ao abrir o PDV o cursor já fica na pesquisa.
  useEffect(() => {
    if (!enabled) return;
    notify("mount");
  }, [enabled, notify]);

  return { notify, focusSearch, focusDiscount, focusQuantity };
}
