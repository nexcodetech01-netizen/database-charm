/**
 * SaleStore — reducer puro do estado de uma venda em edição.
 *
 * Headless por construção: não importa React, Supabase nem UI. O
 * formulário atual continua com seu próprio `useState` (nada foi
 * alterado nele); o Store existe para que o PDV e consumidores
 * programáticos manipulem a mesma venda sem recriar transições.
 */
import type { SaleItemDraft } from "../types";
import type { SaleDraftState } from "../engine/types";

export type SaleAction =
  | { type: "SET_FIELD"; field: keyof SaleDraftState; value: never }
  | { type: "SET_NUMBER"; value: string }
  | { type: "SET_CUSTOMER"; value: string }
  | { type: "SET_PAYMENT_METHOD"; value: string }
  | { type: "SET_STATUS"; value: string }
  | { type: "SET_DISCOUNT"; value: number }
  | { type: "SET_SHIPPING"; value: number }
  | { type: "SET_NOTES"; value: string }
  | { type: "SET_ITEMS"; items: SaleItemDraft[] }
  | { type: "ADD_ITEM"; item: SaleItemDraft }
  | { type: "UPDATE_ITEM"; uiKey: string; patch: Partial<SaleItemDraft> }
  | { type: "REMOVE_ITEM"; uiKey: string }
  | { type: "UPDATE_ITEM_PRICE"; uiKey: string; price: number; reason?: string }
  | { type: "UPDATE_ITEM_DISCOUNT"; uiKey: string; discount: number }
  | { type: "UPDATE_ITEM_ADDITION"; uiKey: string; addition: number }
  | { type: "UPDATE_ITEM_NOTES"; uiKey: string; notes: string }
  | { type: "HYDRATE"; state: SaleDraftState }
  | { type: "RESET"; state?: Partial<SaleDraftState> };

export function createSaleDraftState(
  overrides: Partial<SaleDraftState> = {},
): SaleDraftState {
  return {
    number: "",
    customerId: "",
    paymentMethod: "pix_manual",
    status: "draft",
    discount: 0,
    shipping: 0,
    notes: "",
    items: [],
    ...overrides,
  };
}

export function saleReducer(
  state: SaleDraftState,
  action: SaleAction,
): SaleDraftState {
  switch (action.type) {
    case "SET_NUMBER":
      return { ...state, number: action.value };
    case "SET_CUSTOMER":
      return { ...state, customerId: action.value };
    case "SET_PAYMENT_METHOD":
      return { ...state, paymentMethod: action.value };
    case "SET_STATUS":
      return { ...state, status: action.value };
    case "SET_DISCOUNT":
      return { ...state, discount: Number(action.value) || 0 };
    case "SET_SHIPPING":
      return { ...state, shipping: Number(action.value) || 0 };
    case "SET_NOTES":
      return { ...state, notes: action.value };
    case "SET_ITEMS":
      return { ...state, items: action.items };
    case "ADD_ITEM":
      return { ...state, items: [...state.items, action.item] };
    case "UPDATE_ITEM":
      return {
        ...state,
        items: state.items.map((it) =>
          it.ui_key === action.uiKey ? { ...it, ...action.patch } : it,
        ),
      };
    case "REMOVE_ITEM":
      return {
        ...state,
        items: state.items.filter((it) => it.ui_key !== action.uiKey),
      };
    case "UPDATE_ITEM_PRICE":
      return {
        ...state,
        items: state.items.map((it) =>
          it.ui_key === action.uiKey
            ? {
                ...it,
                unit_price: action.price,
                original_unit_price: it.original_unit_price ?? it.unit_price,
              }
            : it,
        ),
      };
    case "UPDATE_ITEM_DISCOUNT":
      return {
        ...state,
        items: state.items.map((it) =>
          it.ui_key === action.uiKey ? { ...it, discount: action.discount } : it,
        ),
      };
    case "UPDATE_ITEM_ADDITION":
      return {
        ...state,
        items: state.items.map((it) =>
          it.ui_key === action.uiKey ? { ...it, addition: action.addition } : it,
        ),
      };
    case "UPDATE_ITEM_NOTES":
      return {
        ...state,
        items: state.items.map((it) =>
          it.ui_key === action.uiKey ? { ...it, notes: action.notes } : it,
        ),
      };
    case "HYDRATE":
      return { ...action.state };
    case "RESET":
      return createSaleDraftState(action.state);
    default:
      return state;
  }
}
