/**
* useSaleDraft — hook headless que casa o SaleStore com o SaleEngine.
 *
 * Não renderiza nada e não fala com o banco: entrega estado, ações e as
 * derivações do motor (totais, insuficiências de estoque, validações).
 * É o ponto de entrada previsto para o PDV — a tela do PDV só monta UI
 * em cima deste hook.
 */
import { useMemo, useReducer, useCallback } from "react";
import {
  createSaleDraftState,
  saleReducer,
  type SaleAction,
} from "../store/sale-store";
import { SaleEngine } from "../engine/sale-engine";
import type { SaleDraftState } from "../engine/types";
import type { SaleItemDraft } from "../types";

export function useSaleDraft(initial?: Partial<SaleDraftState>) {
  const [state, dispatch] = useReducer(
    saleReducer,
    initial,
    createSaleDraftState,
  );

  const totals = useMemo(() => SaleEngine.computeTotals(state), [state]);

  const stockIssues = useMemo(
    () => SaleEngine.evaluateStock(state.items),
    [state.items],
  );

  const validation = useMemo(
    () => ({
      identity: SaleEngine.validateIdentity(state),
      customer: SaleEngine.validateCustomer(state),
      items: SaleEngine.validateItems(state.items),
    }),
    [state],
  );

  const canFinalize =
    validation.identity.ok &&
    validation.customer.ok &&
    validation.items.ok &&
    stockIssues.length === 0;

  const setItems = useCallback(
    (items: SaleItemDraft[]) => dispatch({ type: "SET_ITEMS", items }),
    [],
  );

  return {
    state,
    dispatch: dispatch as React.Dispatch<SaleAction>,
    totals,
    stockIssues,
    validation,
    canFinalize,
    setItems,
    engine: SaleEngine,
  };
}
