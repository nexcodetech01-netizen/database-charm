/**
 * Bella Contadora — store de sessão das notificações proativas.
 *
 * Estado apenas em memória (sessão). Nada é gravado em banco, não existe
 * websocket nem realtime: o dashboard publica o que já calculou e a sidebar
 * apenas lê o indicador crítico.
 */
import { useSyncExternalStore } from "react";
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
    return filterDismissed(state.notifications, state.dismissed);
  },
  criticalCount(): number {
    return countCritical(this.visible());
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
  return {
    notifications: filterDismissed(snapshot.notifications, snapshot.dismissed),
    dismissed: snapshot.dismissed,
    dismiss: (id: string) => bellaNotificationStore.dismiss(id),
    clearDismissed: () => bellaNotificationStore.clearDismissed(),
  };
}

/** Indicador de notificação crítica (sidebar). */
export function useBellaCriticalCount(): number {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
  return countCritical(filterDismissed(snapshot.notifications, snapshot.dismissed));
}
