/**
 * Bella Contadora — store de sessão das notificações proativas.
 *
 * Estado apenas em memória (sessão). Nada é gravado em banco, não existe
 * websocket nem realtime: o dashboard publica o que já calculou e a sidebar
 * apenas lê o indicador crítico.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { countCritical, filterDismissed, sortNotifications } from "./helpers";
import type { BellaNotification } from "./types";

interface StoreState {
  notifications: BellaNotification[];
  dismissed: string[];
}

let state: StoreState = { notifications: [], dismissed: [] };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function sameIds(a: readonly BellaNotification[], b: readonly BellaNotification[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((n, i) => n.id === b[i]!.id && n.priority === b[i]!.priority);
}

/**
 * Derivações memoizadas por identidade de estado (Sprint 6.1.6 — P2/P3).
 * Enquanto o objeto de estado não muda, `visible` e `criticalCount` não são
 * recalculados. O comportamento observável é idêntico.
 */
let derivedFor: StoreState | null = null;
let derivedVisible: BellaNotification[] = [];
let derivedCritical = 0;

function derive(snapshot: StoreState) {
  if (derivedFor !== snapshot) {
    derivedFor = snapshot;
    derivedVisible = filterDismissed(snapshot.notifications, snapshot.dismissed);
    derivedCritical = countCritical(derivedVisible);
  }
  return { visible: derivedVisible, critical: derivedCritical };
}

export const bellaNotificationStore = {
  getState(): StoreState {
    return state;
  },
  /** Publica o conjunto atual (idempotente). */
  setNotifications(list: readonly BellaNotification[]): void {
    const next = sortNotifications(list);
    if (sameIds(next, state.notifications)) return;
    state = { ...state, notifications: next };
    emit();
  },
  dismiss(id: string): void {
    if (state.dismissed.includes(id)) return;
    state = { ...state, dismissed: [...state.dismissed, id] };
    emit();
  },
  restore(id: string): void {
    if (!state.dismissed.includes(id)) return;
    state = { ...state, dismissed: state.dismissed.filter((d) => d !== id) };
    emit();
  },
  clearDismissed(): void {
    if (state.dismissed.length === 0) return;
    state = { ...state, dismissed: [] };
    emit();
  },
  reset(): void {
    state = { notifications: [], dismissed: [] };
    emit();
  },
  visible(): BellaNotification[] {
    return derive(state).visible;
  },
  criticalCount(): number {
    return derive(state).critical;
  },
  subscribe,
};

/** Lista visível (sem as fechadas na sessão). */
export function useBellaNotifications(): {
  notifications: BellaNotification[];
  dismissed: string[];
  dismiss: (id: string) => void;
  clearDismissed: () => void;
} {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
  const notifications = useMemo(() => derive(snapshot).visible, [snapshot]);
  const dismiss = useCallback((id: string) => bellaNotificationStore.dismiss(id), []);
  const clearDismissed = useCallback(() => bellaNotificationStore.clearDismissed(), []);
  return useMemo(
    () => ({ notifications, dismissed: snapshot.dismissed, dismiss, clearDismissed }),
    [notifications, snapshot.dismissed, dismiss, clearDismissed],
  );
}

/**
 * Indicador de notificação crítica (sidebar).
 * O snapshot já devolve o número: alterações em notificações não críticas
 * não provocam re-render do consumidor.
 */
export function useBellaCriticalCount(): number {
  return useSyncExternalStore(
    subscribe,
    () => derive(state).critical,
    () => derive(state).critical,
  );
}
