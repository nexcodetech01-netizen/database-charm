import { useCallback, useMemo, useReducer, useState } from "react";
import { SaleEngine } from "../../engine";
import type { SaleDraftState, SaleTotals } from "../../engine/types";
import { createSaleDraftState, saleReducer } from "../../store/sale-store";
import { useDiscountPolicy } from "../../lib/discounts";
import type { DiscountEvaluation } from "../../lib/discounts";
import type { StockInsufficiency } from "../../lib/stock";
import type { SaleItemDraft } from "../../types";
import { countCartUnits, findCartItemByProduct, toCartItem } from "../lib/cart";
import { nextPdvSaleNumber } from "../lib/checkout";
import type { PDVProductOption } from "../types";

export type UsePDV = {
  /** Estado da venda em memória (mesmo contrato do formulário de vendas). */
  state: SaleDraftState;
  search: string;
  setSearch: (value: string) => void;
  /** Totais calculados exclusivamente pelo SaleEngine. */
  totals: SaleTotals;
  /** Avaliação de desconto do SaleEngine (política vigente da empresa). */
  discount: DiscountEvaluation;
  /** Insuficiências de estoque apuradas pelo SaleEngine (apenas aviso). */
  stockIssues: StockInsufficiency<SaleItemDraft>[];
  /** Contagem de unidades no carrinho. */
  itemCount: number;
  addProduct: (product: PDVProductOption, quantity?: number) => void;
  removeItem: (uiKey: string) => void;
  setItemQuantity: (uiKey: string, quantity: number) => void;
  setDiscount: (value: number) => void;
  setCustomer: (customerId: string) => void;
  setItemPrice: (uiKey: string, price: number, reason?: string) => void;
  setItemDiscount: (uiKey: string, discount: number) => void;
  setItemAddition: (uiKey: string, addition: number) => void;
  clear: () => void;
};

/**
 * usePDV — sessão de PDV em memória (Sprint 2.2).
 *
 * Nada é persistido: sem rascunho, sem banco, sem pagamento, sem fiscal.
 * Todo cálculo é delegado ao SaleEngine; o estado usa o SaleStore.
 */
export function usePDV(companyId: string): UsePDV {
  const [state, dispatch] = useReducer(
    saleReducer,
    undefined,
    () => createSaleDraftState({ number: nextPdvSaleNumber() }),
  );
  const [search, setSearch] = useState("");
  const [policy] = useDiscountPolicy(companyId);

  const totals = useMemo(() => SaleEngine.computeTotals(state), [state]);

  const discount = useMemo(
    () =>
      SaleEngine.evaluateDiscount({
        state,
        policy,
        overrideApproved: false,
        totals,
      }),
    [state, policy, totals],
  );

  const stockIssues = useMemo(
    () => SaleEngine.evaluateStock(state.items),
    [state.items],
  );

  const itemCount = useMemo(() => countCartUnits(state.items), [state.items]);

  const addProduct = useCallback(
    (product: PDVProductOption, quantity = 1) => {
      const existing = findCartItemByProduct(state.items, product.id);
      if (existing?.ui_key) {
        dispatch({
          type: "UPDATE_ITEM",
          uiKey: existing.ui_key,
          patch: { quantity: (Number(existing.quantity) || 0) + quantity },
        });
        return;
      }
      dispatch({ type: "ADD_ITEM", item: toCartItem(product, quantity) });
    },
    [state.items],
  );

  const removeItem = useCallback((uiKey: string) => {
    dispatch({ type: "REMOVE_ITEM", uiKey });
  }, []);

  const setItemQuantity = useCallback((uiKey: string, quantity: number) => {
    const qty = Number(quantity);
    dispatch({
      type: "UPDATE_ITEM",
      uiKey,
      patch: { quantity: Number.isFinite(qty) && qty > 0 ? qty : 1 },
    });
  }, []);

  const setDiscountValue = useCallback((value: number) => {
    dispatch({ type: "SET_DISCOUNT", value });
  }, []);

  const setCustomer = useCallback((customerId: string) => {
    dispatch({ type: "SET_CUSTOMER", value: customerId });
  }, []);

  const setItemPrice = useCallback(
    (uiKey: string, price: number, reason?: string) => {
      dispatch({ type: "UPDATE_ITEM_PRICE", uiKey, price, reason });
    },
    [],
  );

  const setItemDiscount = useCallback((uiKey: string, discount: number) => {
    dispatch({ type: "UPDATE_ITEM_DISCOUNT", uiKey, discount });
  }, []);

  const setItemAddition = useCallback((uiKey: string, addition: number) => {
    dispatch({ type: "UPDATE_ITEM_ADDITION", uiKey, addition });
  }, []);

  const clear = useCallback(() => {
    dispatch({ type: "RESET", state: { number: nextPdvSaleNumber() } });
    setSearch("");
  }, []);

  return {
    state,
    search,
    setSearch,
    totals,
    discount,
    stockIssues,
    itemCount,
    addProduct,
    removeItem,
    setItemQuantity,
    setDiscount: setDiscountValue,
    setCustomer,
    setItemPrice,
    setItemDiscount,
    setItemAddition,
    clear,
  };
}
