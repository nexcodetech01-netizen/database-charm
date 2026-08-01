/**
 * PDV — Menu operacional do caixa (UX/UI apenas).
 *
 * Este arquivo NÃO contém regra de negócio: apenas rótulos e a lista de
 * itens do menu. Todas as ações reutilizam diálogos existentes do módulo
 * `features/cash` (MovementDialog, CloseSessionDialog) e a rota /caixa.
 *
 * Rollback: excluir este arquivo, `pdv-cash-menu.tsx` e suas referências.
 */
import { formatOpenedAt } from "@/features/cash";

export type PdvCashMenuAction =
  | "view-session"
  | "cash-out"
  | "cash-in"
  | "close-cash";

export type PdvCashMenuItem = {
  action: PdvCashMenuAction;
  label: string;
  /** Atalho exibido ao lado do item (somente informativo). */
  hint?: string;
  /** Item destrutivo/atenção — apenas estilo. */
  danger?: boolean;
  /** Separador visual antes do item. */
  separatorBefore?: boolean;
};

export const PDV_CASH_MENU_ITEMS: readonly PdvCashMenuItem[] = [
  { action: "view-session", label: "Ver sessão" },
  { action: "cash-out", label: "Sangria" },
  { action: "cash-in", label: "Suprimento" },
  {
    action: "close-cash",
    label: "Fechar caixa",
    hint: "F12",
    danger: true,
    separatorBefore: true,
  },
] as const;

export type PdvCashMenuLabel = {
  title: string;
  detail: string | null;
  open: boolean;
};

/** Rótulo do botão: título + data/hora de abertura em linha secundária. */
export function pdvCashMenuLabel(
  session: { opened_at?: string | null } | null | undefined,
): PdvCashMenuLabel {
  if (!session?.opened_at) {
    return { title: "Caixa Fechado", detail: null, open: false };
  }
  return {
    title: "Caixa Aberto",
    // "31/07/2026 às 10:43" -> "31/07/2026 • 10:43"
    detail: formatOpenedAt(session.opened_at).replace(" às ", " • "),
    open: true,
  };
}
