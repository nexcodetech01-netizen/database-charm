/**
 * PDV — Gestão de vendas suspensas (Sprint 7.2).
 * 
 * Permite "pausar" a venda atual para atender outro cliente,
 * mantendo estado completo em memória local (localStorage).
 */
import { SaleDraftState } from "../../engine/types";

export type SuspendedSale = {
  id: string;
  number: string;
  timestamp: string;
  customerId: string;
  customerName: string | null;
  itemCount: number;
  total: number;
  state: SaleDraftState;
};

const STORAGE_KEY = "nexos_pdv_suspended_sales";

export function getSuspendedSales(companyId: string): SuspendedSale[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(`${STORAGE_KEY}_${companyId}`);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveSuspendedSale(companyId: string, sale: SuspendedSale): void {
  const current = getSuspendedSales(companyId);
  const updated = [sale, ...current];
  localStorage.setItem(`${STORAGE_KEY}_${companyId}`, JSON.stringify(updated));
}

export function removeSuspendedSale(companyId: string, suspendedId: string): void {
  const current = getSuspendedSales(companyId);
  const updated = current.filter((s) => s.id !== suspendedId);
  localStorage.setItem(`${STORAGE_KEY}_${companyId}`, JSON.stringify(updated));
}

export function clearSuspendedSales(companyId: string): void {
  localStorage.removeItem(`${STORAGE_KEY}_${companyId}`);
}
