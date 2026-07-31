/**
 * Isolamento operacional de HOMOLOGAÇÃO.
 *
 * Toda venda que gera NF-e em ambiente `homologation` é marcada no banco com
 * `sales.is_test = true` (trigger `trg_fiscal_documents_mark_test_sale`).
 * Este módulo é a fonte única do "escopo de dados" usado por Caixa,
 * Dashboard, Relatórios e listagens — nunca texto livre, sempre o enum.
 */
import { useSyncExternalStore } from "react";

export type DataScope = "production" | "homologation" | "all";

export const DATA_SCOPES: DataScope[] = ["production", "homologation", "all"];

export const DATA_SCOPE_LABEL: Record<DataScope, string> = {
  production: "Produção",
  homologation: "Homologação",
  all: "Todos",
};

const STORAGE_KEY = "nexos.data-scope";
const listeners = new Set<() => void>();

let current: DataScope | null = null;

function read(): DataScope {
  if (current) return current;
  if (typeof window === "undefined") return "production";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  current = raw === "homologation" || raw === "all" ? raw : "production";
  return current;
}

export function getDataScope(): DataScope {
  return read();
}

export function setDataScope(scope: DataScope): void {
  current = scope;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, scope);
    } catch {
      /* noop */
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Escopo reativo — inclua o valor na queryKey para refetch automático. */
export function useDataScope(): DataScope {
  return useSyncExternalStore(subscribe, read, () => "production" as DataScope);
}

/**
 * Aplica o escopo a um builder do PostgREST sobre a tabela `sales`
 * (coluna `is_test`). `all` não filtra nada.
 */
export function applyDataScope<T>(builder: T, scope: DataScope = getDataScope()): T {
  if (scope === "all") return builder;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (builder as any).eq("is_test", scope === "homologation") as T;
}

/** Conveniência para filtros em memória. */
export function matchesDataScope(isTest: boolean | null | undefined, scope: DataScope) {
  if (scope === "all") return true;
  return scope === "homologation" ? Boolean(isTest) : !isTest;
}
