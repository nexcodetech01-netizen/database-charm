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
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${companyId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Grava no navegador; false se o navegador recusar (cheio ou bloqueado). */
function writeSuspended(companyId: string, sales: SuspendedSale[]): boolean {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${companyId}`, JSON.stringify(sales));
    return true;
  } catch {
    return false;
  }
}

/**
 * Suspende a venda (guarda no navegador). Retorna false se não conseguiu
 * gravar — aí o PDV avisa e NÃO limpa o carrinho (auditoria 04/10: antes a
 * falha era silenciosa).
 */
export function saveSuspendedSale(companyId: string, sale: SuspendedSale): boolean {
  return writeSuspended(companyId, [sale, ...getSuspendedSales(companyId)]);
}

export function removeSuspendedSale(companyId: string, suspendedId: string): boolean {
  return writeSuspended(
    companyId,
    getSuspendedSales(companyId).filter((s) => s.id !== suspendedId),
  );
}

export function clearSuspendedSales(companyId: string): void {
  try {
    localStorage.removeItem(`${STORAGE_KEY}_${companyId}`);
  } catch {
    /* navegador sem storage */
  }
}
