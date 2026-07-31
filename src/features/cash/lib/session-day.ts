import type { CashSession } from "../types";

/**
 * Regra de fechamento diário: cada sessão de caixa representa um único dia
 * operacional. Uma sessão aberta em um dia anterior é considerada pendente
 * de fechamento e deve bloquear novas vendas / abertura de novo caixa.
 */
export function isSessionStale(
  session: Pick<CashSession, "opened_at" | "status"> | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!session || session.status !== "open" || !session.opened_at) return false;
  const opened = new Date(session.opened_at);
  return (
    opened.getFullYear() !== now.getFullYear() ||
    opened.getMonth() !== now.getMonth() ||
    opened.getDate() !== now.getDate()
  );
}

export function formatOpenedAt(openedAt: string | Date): string {
  const d = openedAt instanceof Date ? openedAt : new Date(openedAt);
  const date = d.toLocaleDateString("pt-BR");
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${date} às ${time}`;
}

export function staleSessionMessage(
  session: Pick<CashSession, "opened_at">,
): string {
  return `Existe um caixa aberto desde ${formatOpenedAt(session.opened_at)}. É necessário fechar esse caixa antes de iniciar um novo dia.`;
}
